import path from "path";
import fs from "fs";
import {
  ValidationResult,
  ValidationContext,
  createValidationResult,
  addWarning,
  addError,
} from "./utils/types";
import { loadYamlFile } from "./utils/yaml-loader";
import { normalizeInfrastructure, NormalizedInfrastructure } from "./utils/normalizer";
import { applyDefaults } from "./utils/defaults";
import { validateSshConfig } from "./rules/ssh-validation";
import { loadEnvVariables } from "./rules/path-validation";
import { generatePlan, loadPlan, savePlan } from "./utils/plan-generator";
import { validateAllSecrets } from "./rules/generic-secrets-validator";
import {
  validateDatacenter,
  validateCompute,
  validateCluster,
  validateDatabases,
  validateNetworking,
} from "./validators";
import { Platform, LayerType, InfrastructureTierType } from "../../types";

export interface ValidateOptions {
  platformYamlPath: string;
  layer?: LayerType;
  verbose?: boolean;
  generatePlan?: boolean;
  planOutputPath?: string;
}

/**
 * Main validation orchestrator
 *
 * VALIDATION ORDER:
 * 1. Load platform.yaml
 * 2. Normalize (merge all layer files) → NormalizedInfrastructure
 * 3. Apply defaults (security, HA, network defaults)
 * 4. Validate each layer in dependency order:
 *    datacenter → networking → security → compute → database → observability → k8s → apps
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
      suggestion: "Add layers section with datacenter, compute, networking, security",
    });
    return result;
  }

  const platformDir = path.dirname(path.resolve(options.platformYamlPath));

  // Load environment variables for validation
  const envVars = loadEnvVariables(platformDir);

  // Validate SSH configuration
  if (platform.ssh) {
    validateSshConfig(platform.ssh, platformDir, result, envVars);
  } else {
    addWarning(
      result,
      "platform",
      "ssh",
      "SSH configuration not found",
      "Add SSH configuration for secure server management"
    );
  }

  // Step 2: Normalize infrastructure (merge all layer files)
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

  // Step 3: Apply defaults
  normalized = applyDefaults(normalized);

  // Step 4: Validate in dependency order
  const tier = normalized.project?.infrastructure_tier || "production";

  // If specific layer requested, only validate that
  if (options.layer) {
    validateSpecificLayer(options.layer, normalized, context, result, tier, platformDir, envVars);
    return result;
  }

  // Validate mandatory layers for non-local tiers
  validateMandatoryLayers(normalized, tier, result);

  // 4.1: Datacenter (foundational - physical servers)
  if (normalized.datacenter) {
    validateDatacenter(normalized.datacenter, context, result, tier, envVars);
    validateAllSecrets(normalized.datacenter, "datacenter", "", platformDir, envVars, result);
  }

  // 4.2: Networking (firewall, vpn, dns, public_ip)
  if (normalized.networking) {
    validateNetworking(normalized.networking, context, result, tier);
    validateAllSecrets(normalized.networking, "networking", "", platformDir, envVars, result);
  }

  // 4.3: Compute (VMs)
  if (normalized.compute) {
    validateCompute(normalized.compute, context, result, tier);
    validateAllSecrets(normalized.compute, "compute", "", platformDir, envVars, result);
  }

  // 4.4: Database (PostgreSQL clusters)
  if (normalized.database) {
    validateDatabases(normalized.database, context, result, tier);
    validateAllSecrets(normalized.database, "database", "", platformDir, envVars, result);
  }

  // 4.5: K8s Cluster (optional)
  if (normalized.k8s) {
    validateCluster(normalized.k8s, context, result, tier);
    validateAllSecrets(normalized.k8s, "cluster", "", platformDir, envVars, result);
  }

  // Generate execution plan if requested and validation passed
  if (options.generatePlan && result.valid && result.errors.length === 0) {
    generateExecutionPlan(options, normalized, platformDir, result);
  }

  return result;
}

/**
 * Validates mandatory layers based on infrastructure tier
 */
function validateMandatoryLayers(
  normalized: NormalizedInfrastructure,
  tier: string,
  result: ValidationResult
): void {
  if (tier === "local") return; // Local tier has relaxed requirements

  // Datacenter is always required
  if (!normalized.datacenter) {
    addError(
      result,
      "platform",
      "layers.datacenter",
      `Datacenter layer is mandatory for ${tier} tier`,
      "critical",
      "Add datacenter.yaml with physical server configuration"
    );
  }

  // Networking is required (contains firewall and vpn)
  if (!normalized.networking) {
    addError(
      result,
      "platform",
      "layers.networking",
      `Networking layer is mandatory for ${tier} tier`,
      "critical",
      "Add networking.yaml with firewall and VPN configuration"
    );
  } else {
    // Firewall must be enabled
    if (!normalized.networking.firewall?.enabled) {
      addError(
        result,
        "platform",
        "networking.firewall",
        `Firewall must be enabled for ${tier} tier`,
        "critical",
        "Enable firewall in networking.yaml"
      );
    }

    // VPN must be enabled
    if (!normalized.networking.vpn?.enabled) {
      addError(
        result,
        "platform",
        "networking.vpn",
        `VPN must be enabled for ${tier} tier`,
        "critical",
        "Enable VPN (Headscale) in networking.yaml"
      );
    }
  }

  // Compute is required
  if (!normalized.compute || normalized.compute.virtual_machines.length === 0) {
    addError(
      result,
      "platform",
      "layers.compute",
      `Compute layer with VMs is mandatory for ${tier} tier`,
      "critical",
      "Add compute configuration with at least one VM"
    );
  }
}

/**
 * Validates only a specific layer
 */
function validateSpecificLayer(
  layer: string,
  normalized: NormalizedInfrastructure,
  context: ValidationContext,
  result: ValidationResult,
  tier: InfrastructureTierType,
  platformDir: string,
  envVars: Map<string, string>
): void {
  switch (layer) {
    case "datacenter":
      if (normalized.datacenter) {
        validateDatacenter(normalized.datacenter, context, result, tier, envVars);
        validateAllSecrets(normalized.datacenter, "datacenter", "", platformDir, envVars, result);
      } else {
        addError(result, "platform", "datacenter", "Datacenter configuration not found", "error");
      }
      break;

    case "networking":
      if (normalized.networking) {
        validateNetworking(normalized.networking, context, result, tier);
        validateAllSecrets(normalized.networking, "networking", "", platformDir, envVars, result);
      } else {
        addError(result, "platform", "networking", "Networking configuration not found", "error");
      }
      break;

    case "compute":
      if (normalized.compute) {
        validateCompute(normalized.compute, context, result, tier);
        validateAllSecrets(normalized.compute, "compute", "", platformDir, envVars, result);
      } else {
        addError(result, "platform", "compute", "Compute configuration not found", "error");
      }
      break;

    case "database":
      if (normalized.database) {
        validateDatabases(normalized.database, context, result, tier);
        validateAllSecrets(normalized.database, "database", "", platformDir, envVars, result);
      } else {
        addError(result, "platform", "database", "Database configuration not found", "error");
      }
      break;

    case "cluster":
      if (normalized.k8s) {
        validateCluster(normalized.k8s, context, result, tier);
        validateAllSecrets(normalized.k8s, "cluster", "", platformDir, envVars, result);
      } else {
        addError(result, "platform", "cluster", "Cluster configuration not found", "error");
      }
      break;

    default:
      result.valid = false;
      result.errors.push({
        layer: "platform",
        field: "layer",
        message: `Unknown layer: ${layer}`,
        severity: "error",
        suggestion: "Valid layers: datacenter, networking, compute, database, cluster",
      });
  }
}

/**
 * Generates execution plan
 */
function generateExecutionPlan(
  options: ValidateOptions,
  normalized: NormalizedInfrastructure,
  platformDir: string,
  result: ValidationResult
): void {
  try {
    const existingPlan = options.planOutputPath ? loadPlan(options.planOutputPath) : null;
    const plan = generatePlan(normalized, existingPlan || undefined);
    plan.validation_passed = true;

    const planPath = options.planOutputPath || path.join(platformDir, ".soverstack", "plan.yaml");
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
