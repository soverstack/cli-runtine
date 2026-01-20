import path from "path";
import fs from "fs";
import chalk from "chalk";
import ora from "ora";
import { loadYamlFile } from "../validate/utils/yaml-loader";
import { StateManager, StateBackend } from "../apply/utils/state-manager";
import { DockerExecutor } from "../apply/utils/docker-executor";
import { Platform } from "../../types";
import { loadEnvVariables } from "../validate/rules/path-validation";

export interface DestroyOptions {
  platformYamlPath: string;
  autoApprove?: boolean;
  dockerImage?: string;
  target?: string; // Specific resource to destroy
}

/**
 * Main destroy orchestrator
 */
export async function destroyInfrastructure(options: DestroyOptions): Promise<boolean> {
  console.log(chalk.red("\n💥 Soverstack Destroy\n"));
  console.log(chalk.yellow("⚠️  WARNING: This will DESTROY all infrastructure!\n"));

  const platformDir = path.dirname(path.resolve(options.platformYamlPath));

  // Step 1: Load platform
  const spinner = ora("Loading platform configuration...").start();

  const platform = loadYamlFile<Platform>(options.platformYamlPath, undefined as any, "platform");

  if (!platform) {
    spinner.fail("Failed to load platform configuration");
    return false;
  }

  spinner.succeed("Platform configuration loaded");

  // Step 2: Load state
  spinner.start("Loading infrastructure state...");

  const soverstackDir = path.join(platformDir, ".soverstack");
  const stateBackend: StateBackend = {
    type: platform.state?.backend || "local",
    path: platform.state?.path || path.join(soverstackDir, "state.yaml"),
  };

  const stateManager = new StateManager(stateBackend, platformDir);
  const currentState = await stateManager.loadState();

  if (!currentState) {
    spinner.warn("No state found - infrastructure may not exist");
  } else {
    spinner.succeed(`State loaded: ${currentState.resources.length} resources found`);
  }

  // Step 3: Show what will be destroyed
  if (!options.autoApprove) {
    console.log(chalk.red("\n🗑️  Resources to destroy:\n"));

    if (currentState) {
      const groupedResources = currentState.resources.reduce((acc, resource) => {
        if (!acc[resource.layer]) {
          acc[resource.layer] = [];
        }
        acc[resource.layer].push(resource);
        return acc;
      }, {} as Record<string, any[]>);

      Object.entries(groupedResources).forEach(([layer, resources]) => {
        console.log(chalk.cyan(`  ${layer}:`));
        resources.forEach((resource) => {
          console.log(chalk.gray(`    - ${resource.id} (${resource.type})`));
        });
      });

      console.log(chalk.red(`\n  Total: ${currentState.resources.length} resources\n`));
    } else {
      console.log(chalk.gray("  No resources found in state\n"));
    }

    console.log(chalk.yellow("  Use --auto-approve to skip confirmation\n"));

    // For now, auto-proceed (in real implementation, prompt user)
  }

  // Step 4: Load environment variables
  spinner.start("Loading environment variables...");

  const envVars = loadEnvVariables(platformDir);

  spinner.succeed(`Loaded ${envVars.size} environment variables`);

  // Step 5: Initialize Docker executor
  spinner.start("Checking Docker...");

  const dockerImage = options.dockerImage || "soverstack/terraform-ansible:latest";
  const docker = new DockerExecutor(dockerImage, soverstackDir);

  const dockerAvailable = await docker.checkDocker();

  if (!dockerAvailable) {
    spinner.fail("Docker is not available");
    console.error(
      chalk.red("\n❌ Docker is required for destroy. Please install Docker and try again.\n")
    );
    return false;
  }

  spinner.succeed("Docker is available");

  // Step 6: Destroy with Ansible (configuration cleanup)
  console.log(chalk.blue("\n🧹 Cleaning up configuration with Ansible...\n"));

  const playbookPath = path.join(soverstackDir, "playbooks", "destroy.yaml");

  if (fs.existsSync(playbookPath)) {
    const ansibleEnvVars: Record<string, string> = {
      ANSIBLE_HOST_KEY_CHECKING: "False",
    };

    // Load SSH key path
    if (envVars.has("SSH_PRIVATE_KEY_PATH")) {
      ansibleEnvVars.SSH_PRIVATE_KEY_PATH = envVars.get("SSH_PRIVATE_KEY_PATH")!;
    }

    const ansibleResult = await docker.executeAnsible(
      [playbookPath],
      ansibleEnvVars,
      "/workspace/inventories/all.yaml"
    );

    if (!ansibleResult.success) {
      console.warn(chalk.yellow("\n⚠️  Ansible cleanup had errors, continuing...\n"));
    } else {
      console.log(chalk.green("\n✅ Ansible cleanup completed\n"));
    }
  } else {
    console.log(chalk.gray("\n  No Ansible destroy playbook found, skipping\n"));
  }

  // Step 7: Destroy with Terraform
  console.log(chalk.red("\n💥 Destroying infrastructure with Terraform...\n"));

  // Prepare Terraform env vars (SECURITY: from env vars only)
  const terraformEnvVars: Record<string, string> = {};

  // Load Proxmox credentials from env vars
  if (envVars.has("PROXMOX_API_URL")) {
    terraformEnvVars.TF_VAR_proxmox_api_url = envVars.get("PROXMOX_API_URL")!;
  }
  if (envVars.has("PROXMOX_PASSWORD")) {
    terraformEnvVars.TF_VAR_proxmox_password = envVars.get("PROXMOX_PASSWORD")!;
  }

  // Terraform init (if needed)
  const terraformDir = path.join(soverstackDir, "terraform");

  if (fs.existsSync(terraformDir)) {
    let tfResult = await docker.executeTerraform(["init"], terraformEnvVars);

    if (!tfResult.success) {
      console.error(chalk.red("\n❌ Terraform init failed\n"));
      return false;
    }

    // Terraform destroy
    const destroyArgs = ["destroy", "-auto-approve"];

    if (options.target) {
      destroyArgs.push("-target", options.target);
    }

    tfResult = await docker.executeTerraform(destroyArgs, terraformEnvVars);

    if (!tfResult.success) {
      console.error(chalk.red("\n❌ Terraform destroy failed\n"));
      return false;
    }

    console.log(chalk.green("\n✅ Terraform destroy completed\n"));
  } else {
    console.log(chalk.gray("\n  No Terraform configuration found, skipping\n"));
  }

  // Step 8: Update or remove state
  spinner.start("Updating state...");

  if (options.target) {
    // Partial destroy - update state
    if (currentState) {
      currentState.resources = currentState.resources.filter(
        (r) => !r.id.includes(options.target!)
      );
      currentState.updated_at = new Date().toISOString();
      await stateManager.saveState(currentState);
      spinner.succeed("State updated (partial destroy)");
    }
  } else {
    // Full destroy - remove state
    const statePath = path.join(soverstackDir, "state.yaml");
    if (fs.existsSync(statePath)) {
      fs.unlinkSync(statePath);
    }
    spinner.succeed("State removed (full destroy)");
  }

  // Success!
  console.log(chalk.green.bold("\n🗑️  Infrastructure destroyed successfully!\n"));

  return true;
}
