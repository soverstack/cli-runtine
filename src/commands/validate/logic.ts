import path from "path";
import fs from "fs";
import {
  ValidationResult,
  ValidationContext,
  createValidationResult,
  addWarning,
  addError,
} from "./utils/types";
import { loadYamlFile, validateFilePath } from "./utils/yaml-loader";
import { normalizeInfrastructure, NormalizedInfrastructure } from "./utils/normalizer";
import { applyDefaults } from "./utils/defaults";
import { validateSshConfig } from "./rules/ssh-validation";
import { loadEnvVariables } from "./rules/path-validation";
import { generatePlan, loadPlan, savePlan, InfrastructurePlan } from "./utils/plan-generator";
import { validateAllSecrets } from "./rules/generic-secrets-validator";
import {
  validateDatacenter,
  validateCompute,
  validateCluster,
  validateFirewall,
  validateBastion,
  validateIAM,
  validateFeature,
} from "./validators";
import {
  Datacenter,
  ComputeConfig,
  K8sCluster,
  Firewall,
  Bastion,
  IdentityProvider,
  Feature,
  Platform,
  LayerType,
} from "../../types";

export interface ValidateOptions {
  platformYamlPath: string;
  layer?: LayerType;
  verbose?: boolean;
  generatePlan?: boolean; // Generate execution plan
  planOutputPath?: string; // Where to save the plan
}

/**
 * Main validation orchestrator
 *
 * ARCHITECTURE:
 * 1. Load platform.yaml
 * 2. Normalize (merge advanced mode or extract simple mode) → NormalizedInfrastructure
 * 3. Apply defaults (security, HA, network defaults)
 * 4. Validate the normalized infrastructure
 *
 * This ensures both "simple" and "advanced" modes are validated the same way
 */
export async function validateInfrastructure(options: ValidateOptions): Promise<ValidationResult> {
  const result = createValidationResult();
  const context: ValidationContext = {
    vm_ids_used: new Map(),
    server_names: new Set(),
    host_names: new Set(),
    cluster_names: new Set(),
  };

  // Step 1: Load platform.yaml
  const platform = loadYamlFile<Platform>(options.platformYamlPath, result, "platform");

  if (!platform) {
    return result; // Critical error in platform.yaml
  }

  // Validate platform structure
  if (!platform.layers) {
    result.valid = false;
    result.errors.push({
      layer: "platform",
      field: "layers",
      message: "Platform layers configuration is missing",
      severity: "critical",
      suggestion: "Add layers section with datacenter, compute, clusters, and features",
    });
    return result;
  }

  // Validate environment configuration
  const platformDir = path.dirname(path.resolve(options.platformYamlPath));
  validateEnvironments(platform, platformDir, result);

  // Load environment variables for validation
  const envVars = loadEnvVariables(platformDir, platform.environment);

  // Validate SSH configuration
  let sshConfig = null;
  if (platform.ssh) {
    sshConfig = validateSshConfig(platform.ssh, platformDir, result, envVars);
  } else {
    addWarning(
      result,
      "platform",
      "ssh",
      "SSH configuration not found",
      "Add SSH configuration to enable secure server management"
    );
  }

  // Step 2: Normalize infrastructure (merge advanced mode or extract simple mode)
  let normalized: NormalizedInfrastructure;

  try {
    normalized = await normalizeInfrastructure(platform, platformDir);
  } catch (error) {
    result.valid = false;
    result.errors.push({
      layer: "platform",
      field: "layers",
      message: `Failed to load infrastructure layers: ${(error as Error).message}`,
      severity: "critical",
    });
    return result;
  }

  // Step 3: Apply defaults (security, HA, network)
  normalized = applyDefaults(normalized);

  // Step 4: Validate in dependency order (using normalized infrastructure)
  // Datacenter → Firewall → Bastion → Compute → Cluster → Features

  // If specific layer requested, only validate that
  if (options.layer) {
    validateSpecificLayer(options.layer, normalized, context, result, envVars);
    return result;
  }

  // Otherwise, validate all layers in order
  const infrastructureTier = normalized.project?.infrastructure_tier || "production";

  // Validate mandatory layers for non-local tiers
  if (infrastructureTier !== "local") {
    // Datacenter is always required
    if (!normalized.datacenter) {
      addError(
        result,
        "platform",
        "layers.datacenter",
        `Datacenter layer is mandatory for ${infrastructureTier} tier`,
        "critical",
        "Add datacenter configuration"
      );
    }

    // Firewall is mandatory for production/enterprise
    if (!normalized.firewall) {
      addError(
        result,
        "platform",
        "layers.firewall",
        `Firewall layer is mandatory for ${infrastructureTier} tier`,
        "critical",
        "Add firewall configuration with VyOS for network security"
      );
    }

    // Bastion is mandatory for production/enterprise
    if (!normalized.bastion) {
      addError(
        result,
        "platform",
        "layers.bastion",
        `Bastion layer is mandatory for ${infrastructureTier} tier`,
        "critical",
        "Add bastion configuration with Headscale for secure VPN access"
      );
    }

    // Compute is mandatory for production/enterprise
    if (!normalized.compute || normalized.compute.virtual_machines.length === 0) {
      addError(
        result,
        "platform",
        "layers.compute",
        `Compute layer with VMs is mandatory for ${infrastructureTier} tier`,
        "critical",
        "Add compute configuration with at least one VM"
      );
    }
  }

  // 4.1: Datacenter (foundational)
  if (normalized.datacenter) {
    validateDatacenter(normalized.datacenter, context, result, infrastructureTier, envVars);
    validateAllSecrets(normalized.datacenter, "datacenter", "", platformDir, envVars, result);
  }

  // 4.2: Firewall
  if (normalized.firewall) {
    validateFirewall(normalized.firewall, context, result, infrastructureTier);
    validateAllSecrets(normalized.firewall, "firewall", "", platformDir, envVars, result);
  }

  // 4.3: Bastion
  if (normalized.bastion) {
    validateBastion(normalized.bastion, context, result, infrastructureTier);
    validateAllSecrets(normalized.bastion, "bastion", "", platformDir, envVars, result);
  }

  // 4.4: IAM (MANDATORY for production/enterprise)
  if (normalized.iam) {
    validateIAM(normalized.iam, context, result, infrastructureTier);
    validateAllSecrets(normalized.iam, "iam", "", platformDir, envVars, result);
  } else if (infrastructureTier === "production" || infrastructureTier === "enterprise") {
    // IAM is MANDATORY for production/enterprise
    addError(
      result,
      "platform",
      "layers.iam",
      `IAM layer is mandatory for ${infrastructureTier} tier`,
      "critical",
      "Add IAM configuration with Keycloak for identity and access management"
    );
  }
  // 4.5: Compute (needs datacenter context)
  if (normalized.compute) {
    validateCompute(normalized.compute, context, result, infrastructureTier);
    validateAllSecrets(normalized.compute, "compute", "", platformDir, envVars, result);
  }

  // 4.6: Clusters (needs compute context)
  if (normalized.cluster) {
    validateCluster(normalized.cluster, context, result, infrastructureTier);
    validateAllSecrets(normalized.cluster, "cluster", "", platformDir, envVars, result);
  }

  // 4.7: Features (needs cluster context)
  if (normalized.features) {
    validateFeature(normalized.features, context, result, infrastructureTier);
    validateAllSecrets(normalized.features, "features", "", platformDir, envVars, result);
  }

  // Generate execution plan if requested and validation passed
  if (options.generatePlan && result.valid && result.errors.length === 0) {
    try {
      // Load existing plan if it exists
      const existingPlan = options.planOutputPath ? loadPlan(options.planOutputPath) : null;

      // Generate new plan
      const plan = generatePlan(normalized, existingPlan || undefined);
      plan.validation_passed = true;

      // Save plan
      const planPath = options.planOutputPath || path.join(platformDir, ".soverstack", "plan.yaml");

      // Create directory if it doesn't exist
      const planDir = path.dirname(planPath);
      if (!fs.existsSync(planDir)) {
        fs.mkdirSync(planDir, { recursive: true });
      }

      savePlan(plan, planPath);

      addWarning(
        result,
        "platform",
        "plan",
        `Execution plan generated: ${planPath}`,
        `Plan contains ${plan.summary.to_create} resources to create, ${plan.summary.to_update} to update, ${plan.summary.to_delete} to delete`
      );
    } catch (error) {
      addWarning(
        result,
        "platform",
        "plan",
        `Failed to generate execution plan: ${(error as Error).message}`,
        "Validation passed but plan generation failed"
      );
    }
  }

  return result;
}

/**
 * Validates only a specific layer from normalized infrastructure
 */
function validateSpecificLayer(
  layer: string,
  normalized: NormalizedInfrastructure,
  context: ValidationContext,
  result: ValidationResult,
  envVars: Map<string, string>
): void {
  const infrastructureTier = normalized.project?.infrastructure_tier || "production";

  // Validate mandatory layers for non-local tiers
  if (infrastructureTier !== "local") {
    // Datacenter is always required
    if (!normalized.datacenter) {
      addError(
        result,
        "platform",
        "layers.datacenter",
        `Datacenter layer is mandatory for ${infrastructureTier} tier`,
        "critical",
        "Add datacenter configuration"
      );
    }

    // Firewall is mandatory for production/enterprise
    if (!normalized.firewall) {
      addError(
        result,
        "platform",
        "layers.firewall",
        `Firewall layer is mandatory for ${infrastructureTier} tier`,
        "critical",
        "Add firewall configuration with VyOS for network security"
      );
    }

    // Bastion is mandatory for production/enterprise
    if (!normalized.bastion) {
      addError(
        result,
        "platform",
        "layers.bastion",
        `Bastion layer is mandatory for ${infrastructureTier} tier`,
        "critical",
        "Add bastion configuration with Headscale for secure VPN access"
      );
    }

    // Compute is mandatory for production/enterprise
    if (!normalized.compute || normalized.compute.virtual_machines.length === 0) {
      addError(
        result,
        "platform",
        "layers.compute",
        `Compute layer with VMs is mandatory for ${infrastructureTier} tier`,
        "critical",
        "Add compute configuration with at least one VM"
      );
    }
  }

  const platformDir = ""; // Will be set properly

  switch (layer) {
    case "datacenter":
      if (normalized.datacenter) {
        validateDatacenter(normalized.datacenter, context, result, infrastructureTier, envVars);
        validateAllSecrets(normalized.datacenter, "datacenter", "", platformDir, envVars, result);
      } else {
        result.errors.push({
          layer: "platform",
          field: "datacenter",
          message: "Datacenter configuration not found",
          severity: "error",
        });
      }
      break;

    case "firewall":
      if (normalized.firewall) {
        validateFirewall(normalized.firewall, context, result, infrastructureTier);
        validateAllSecrets(normalized.firewall, "firewall", "", platformDir, envVars, result);
      } else {
        result.errors.push({
          layer: "platform",
          field: "firewall",
          message: "Firewall configuration not found",
          severity: "error",
        });
      }
      break;

    case "bastion":
      if (normalized.bastion) {
        validateBastion(normalized.bastion, context, result, infrastructureTier);
        validateAllSecrets(normalized.bastion, "bastion", "", platformDir, envVars, result);
      } else {
        result.errors.push({
          layer: "platform",
          field: "bastion",
          message: "Bastion configuration not found",
          severity: "error",
        });
      }
      break;

    case "compute":
      if (normalized.compute) {
        validateCompute(normalized.compute, context, result, infrastructureTier);
        validateAllSecrets(normalized.compute, "compute", "", platformDir, envVars, result);
      } else {
        result.errors.push({
          layer: "platform",
          field: "compute",
          message: "Compute configuration not found",
          severity: "error",
        });
      }
      break;

    case "cluster":
      if (normalized.cluster) {
        validateCluster(normalized.cluster, context, result, infrastructureTier);
        validateAllSecrets(normalized.cluster, "cluster", "", platformDir, envVars, result);
      } else {
        result.errors.push({
          layer: "platform",
          field: "cluster",
          message: "Cluster configuration not found",
          severity: "error",
        });
      }
      break;

    case "feature":
      if (normalized.features) {
        validateFeature(normalized.features, context, result, infrastructureTier);
        validateAllSecrets(normalized.features, "features", "", platformDir, envVars, result);
      } else {
        result.errors.push({
          layer: "platform",
          field: "features",
          message: "Features configuration not found",
          severity: "error",
        });
      }
      break;

    default:
      result.valid = false;
      result.errors.push({
        layer: "platform",
        field: "layer",
        message: `Unknown layer: ${layer}`,
        severity: "error",
        suggestion: "Valid layers: datacenter, compute, cluster, feature, firewall, bastion, iam",
      });
  }
}

/**
 * Validates that configured environments have corresponding .env files
 */
function validateEnvironments(
  platform: Platform,
  platformDir: string,
  result: ValidationResult
): void {
  if (!platform.environment) return;

  const envFile = path.join(platformDir, `.env.${platform.environment}`);
  const fallbackEnvFile = path.join(platformDir, `.env`);

  if (!fs.existsSync(envFile) && !fs.existsSync(fallbackEnvFile)) {
    addWarning(
      result,
      "platform",
      "environment",
      `Environment "${platform.environment}" configured but no .env.${platform.environment} or .env file found`,
      `Create .env.${platform.environment} file with required environment variables`
    );
  }
}
