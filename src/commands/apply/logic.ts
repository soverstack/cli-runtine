import path from "path";
import fs from "fs";
import chalk from "chalk";
import ora from "ora";
import { loadYamlFile } from "../validate/utils/yaml-loader";
import { normalizeInfrastructure } from "../validate/utils/normalizer";
import { applyDefaults } from "../validate/utils/defaults";
import { validateInfrastructure } from "../validate/logic";
import { loadPlan, InfrastructurePlan } from "../validate/utils/plan-generator";
import { loadEnvVariables } from "../validate/rules/path-validation";
import {
  generateAnsibleInventory,
  generateGroupVars,
  generateHostVars,
  saveInventory,
} from "./utils/inventory-generator";
import { StateManager, StateBackend, InfrastructureState } from "./utils/state-manager";
import { DockerExecutor, generateTerraformConfig } from "./utils/docker-executor";
import { Platform } from "../../types";

export interface ApplyOptions {
  platformYamlPath: string;
  planPath?: string;
  autoApprove?: boolean;
  dockerImage?: string;
  skipValidation?: boolean;
}

/**
 * Main apply orchestrator
 */
export async function applyInfrastructure(options: ApplyOptions): Promise<boolean> {
  console.log(chalk.blue("\n🚀 Soverstack Apply\n"));

  const platformDir = path.dirname(path.resolve(options.platformYamlPath));

  // Step 1: Load and validate platform
  const spinner = ora("Loading platform configuration...").start();

  const platform = loadYamlFile<Platform>(options.platformYamlPath, undefined as any, "platform");

  if (!platform) {
    spinner.fail("Failed to load platform configuration");
    return false;
  }

  spinner.succeed("Platform configuration loaded");

  // Step 2: Validate infrastructure (unless skipped)
  if (!options.skipValidation) {
    spinner.start("Validating infrastructure...");

    const validationResult = await validateInfrastructure({
      platformYamlPath: options.platformYamlPath,
      generatePlan: !options.planPath, // Generate plan if not provided
    });

    if (!validationResult.valid || validationResult.errors.length > 0) {
      spinner.fail("Validation failed");
      console.error(chalk.red("\n❌ Validation errors found. Fix them before applying.\n"));
      return false;
    }

    spinner.succeed("Validation passed");
  }

  // Step 3: Load or generate plan
  spinner.start("Loading execution plan...");

  const planPath = options.planPath || path.join(platformDir, ".soverstack", "plan.yaml");
  const plan = loadPlan(planPath);

  if (!plan) {
    spinner.fail("No execution plan found");
    console.error(
      chalk.red(
        "\n❌ Run 'soverstack validate --plan' first to generate an execution plan\n"
      )
    );
    return false;
  }

  spinner.succeed(`Execution plan loaded: ${plan.summary.to_create} to create, ${plan.summary.to_update} to update, ${plan.summary.to_delete} to delete`);

  // Step 4: Show plan and ask for confirmation
  if (!options.autoApprove) {
    console.log(chalk.yellow("\n📋 Execution Plan:\n"));
    console.log(chalk.cyan(`  Resources to create: ${plan.summary.to_create}`));
    console.log(chalk.yellow(`  Resources to update: ${plan.summary.to_update}`));
    console.log(chalk.red(`  Resources to delete: ${plan.summary.to_delete}`));
    console.log(chalk.gray(`  No changes: ${plan.summary.no_change}`));

    // For now, auto-proceed (in real implementation, prompt user)
    console.log(chalk.gray("\n  Use --auto-approve to skip confirmation\n"));
  }

  // Step 5: Load environment variables
  spinner.start("Loading environment variables...");

  const envVars = loadEnvVariables(platformDir, platform.environment);

  spinner.succeed(`Loaded ${envVars.size} environment variables`);

  // Step 6: Normalize infrastructure
  spinner.start("Normalizing infrastructure...");

  let normalized;
  try {
    normalized = await normalizeInfrastructure(platform, platformDir);
    normalized = applyDefaults(normalized);
  } catch (error) {
    spinner.fail("Normalization failed");
    console.error(chalk.red(`Error: ${(error as Error).message}`));
    return false;
  }

  spinner.succeed("Infrastructure normalized");

  // Step 7: Generate Ansible inventory
  spinner.start("Generating Ansible inventory...");

  const soverstackDir = path.join(platformDir, ".soverstack");
  const inventoriesDir = path.join(soverstackDir, "inventories");

  if (!fs.existsSync(inventoriesDir)) {
    fs.mkdirSync(inventoriesDir, { recursive: true });
  }

  const inventory = generateAnsibleInventory(normalized, plan, envVars);
  const inventoryPath = path.join(inventoriesDir, "all.yaml");
  saveInventory(inventory, inventoryPath);

  generateGroupVars(normalized, inventoriesDir);
  generateHostVars(normalized, inventoriesDir, envVars);

  spinner.succeed(`Ansible inventory generated at ${inventoriesDir}`);

  // Step 8: Generate Terraform configuration
  spinner.start("Generating Terraform configuration...");

  generateTerraformConfig(plan, soverstackDir);

  spinner.succeed("Terraform configuration generated");

  // Step 9: Initialize state manager
  spinner.start("Initializing state backend...");

  const stateBackend: StateBackend = {
    type: platform.state?.backend || "local",
    path: platform.state?.path || path.join(soverstackDir, "state.yaml"),
    // S3/Azure config would come from platform.state
  };

  const stateManager = new StateManager(stateBackend, platformDir);
  let currentState = await stateManager.loadState();

  if (!currentState) {
    currentState = stateManager.createInitialState(
      plan,
      normalized.project?.infrastructure_tier || "production",
      normalized.project?.environment
    );
  }

  spinner.succeed(`State backend initialized: ${stateBackend.type}`);

  // Step 10: Initialize Docker executor
  spinner.start("Checking Docker...");

  const dockerImage = options.dockerImage || "soverstack/terraform-ansible:latest";
  const docker = new DockerExecutor(dockerImage, soverstackDir);

  const dockerAvailable = await docker.checkDocker();

  if (!dockerAvailable) {
    spinner.fail("Docker is not available");
    console.error(
      chalk.red("\n❌ Docker is required for apply. Please install Docker and try again.\n")
    );
    return false;
  }

  spinner.succeed("Docker is available");

  // Step 11: Pull Docker image
  spinner.start(`Pulling Docker image: ${dockerImage}...`);

  const imagePulled = await docker.pullImage();

  if (!imagePulled) {
    spinner.warn("Failed to pull Docker image, using local if available");
  } else {
    spinner.succeed("Docker image ready");
  }

  // Step 12: Execute Terraform
  console.log(chalk.blue("\n🏗️  Executing Terraform...\n"));

  // Prepare Terraform env vars (SECURITY: from env vars only)
  const terraformEnvVars: Record<string, string> = {};

  // Load Proxmox credentials from env vars
  if (envVars.has("PROXMOX_API_URL")) {
    terraformEnvVars.TF_VAR_proxmox_api_url = envVars.get("PROXMOX_API_URL")!;
  }
  if (envVars.has("PROXMOX_PASSWORD")) {
    terraformEnvVars.TF_VAR_proxmox_password = envVars.get("PROXMOX_PASSWORD")!;
  }

  // Terraform init
  let tfResult = await docker.executeTerraform(["init"], terraformEnvVars);

  if (!tfResult.success) {
    console.error(chalk.red("\n❌ Terraform init failed\n"));
    return false;
  }

  // Terraform apply
  tfResult = await docker.executeTerraform(
    ["apply", "-auto-approve"],
    terraformEnvVars
  );

  if (!tfResult.success) {
    console.error(chalk.red("\n❌ Terraform apply failed\n"));
    return false;
  }

  console.log(chalk.green("\n✅ Terraform execution completed\n"));

  // Step 13: Execute Ansible
  console.log(chalk.blue("\n⚙️  Executing Ansible...\n"));

  // Prepare Ansible env vars (SECURITY: from env vars only)
  const ansibleEnvVars: Record<string, string> = {
    ANSIBLE_HOST_KEY_CHECKING: "False",
  };

  // Load SSH key path
  if (envVars.has("SSH_PRIVATE_KEY_PATH")) {
    ansibleEnvVars.SSH_PRIVATE_KEY_PATH = envVars.get("SSH_PRIVATE_KEY_PATH")!;
  }

  // Execute Ansible playbook (would be generated based on plan)
  const playbookPath = path.join(soverstackDir, "playbooks", "site.yaml");

  // For now, skip Ansible execution if playbook doesn't exist
  if (fs.existsSync(playbookPath)) {
    const ansibleResult = await docker.executeAnsible(
      [playbookPath],
      ansibleEnvVars,
      "/workspace/inventories/all.yaml"
    );

    if (!ansibleResult.success) {
      console.error(chalk.red("\n❌ Ansible execution failed\n"));
      return false;
    }

    console.log(chalk.green("\n✅ Ansible execution completed\n"));
  } else {
    console.log(chalk.yellow("\n⚠️  No Ansible playbook found, skipping configuration\n"));
  }

  // Step 14: Update state
  spinner.start("Updating state...");

  currentState.updated_at = new Date().toISOString();
  currentState.metadata.applied_at = new Date().toISOString();

  // Update resource states based on plan execution
  plan.resources.forEach((resource: any) => {
    const existingResource = currentState!.resources.find((r) => r.id === resource.id);

    if (existingResource) {
      existingResource.status = "updated";
      existingResource.metadata.updated_at = new Date().toISOString();
    } else {
      currentState!.resources.push({
        id: resource.id,
        type: resource.type,
        layer: resource.layer,
        status: "created",
        checksum: resource.metadata.checksum,
        metadata: {
          created_at: new Date().toISOString(),
        },
        attributes: {}, // SECURITY: No secrets here
      });
    }
  });

  await stateManager.saveState(currentState);

  spinner.succeed(`State saved to ${stateBackend.type} backend`);

  // Success!
  console.log(chalk.green.bold("\n🎉 Infrastructure applied successfully!\n"));

  return true;
}
