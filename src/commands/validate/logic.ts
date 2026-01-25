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
import { normalizeInfrastructure, NormalizedInfrastructure, NormalizedRegion, NormalizedHub, NormalizedZone } from "./utils/normalizer";
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
import { Platform, LayerType, InfrastructureTierType, ComputeConfig } from "../../types";
import { INFRASTRUCTURE_REQUIREMENTS } from "../../infrastructure-requirements";
import { HA_REQUIREMENTS } from "../../constants";

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
 * 4. Validate structure based on mode:
 *    - NEW: regions/hub/zones
 *    - LEGACY: single-DC or multi-DC
 * 5. Validate each layer in dependency order
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
      field: "structure",
      message: `Failed to load infrastructure: ${(error as Error).message}`,
      severity: "critical",
    });
    return result;
  }

  // Step 3: Apply defaults
  normalized = applyDefaults(normalized);

  // Step 4: Validate based on structure mode
  const tier = normalized.project?.infrastructure_tier || "production";

  // If specific layer requested, only validate that
  if (options.layer) {
    validateSpecificLayer(options.layer, normalized, context, result, tier, platformDir, envVars);
    return result;
  }

  // ════════════════════════════════════════════════════════════════════════
  // NEW STRUCTURE: Regions
  // ════════════════════════════════════════════════════════════════════════
  if (normalized.regions && normalized.regions.length > 0) {
    validateRegionsStructure(normalized, context, result, tier, platformDir, envVars);
  }
  // ════════════════════════════════════════════════════════════════════════
  // LEGACY: Single-DC or Multi-DC
  // ════════════════════════════════════════════════════════════════════════
  else if (normalized.datacenters && normalized.datacenters.length > 0) {
    // Multi-DC mode
    for (const dc of normalized.datacenters) {
      validateDatacenterLayers(dc.name, {
        datacenter: dc.datacenter,
        networking: dc.networking,
        security: dc.security,
        compute: dc.compute,
        database: dc.database,
        k8s: dc.k8s,
      }, context, result, tier, platformDir, envVars);
    }
  } else if (normalized.datacenter || normalized.compute) {
    // Single-DC mode
    validateDatacenterLayers("default", {
      datacenter: normalized.datacenter,
      networking: normalized.networking,
      security: normalized.security,
      compute: normalized.compute,
      database: normalized.database,
      k8s: normalized.k8s,
    }, context, result, tier, platformDir, envVars);
  } else {
    // No valid structure found
    result.valid = false;
    result.errors.push({
      layer: "platform",
      field: "structure",
      message: "No valid infrastructure structure found",
      severity: "critical",
      suggestion: "Add 'regions' for new structure, 'layers' for single-DC, or 'datacenters' for multi-DC",
    });
  }

  // Generate execution plan if requested and validation passed
  if (options.generatePlan && result.valid && result.errors.length === 0) {
    generateExecutionPlan(options, normalized, platformDir, result);
  }

  return result;
}

/**
 * Validates the new regions/hub/zones structure
 */
function validateRegionsStructure(
  normalized: NormalizedInfrastructure,
  context: ValidationContext,
  result: ValidationResult,
  tier: InfrastructureTierType,
  platformDir: string,
  envVars: Map<string, string>
): void {
  const haReqs = HA_REQUIREMENTS[tier];

  // Validate control_plane_runs_on is set
  if (!normalized.control_plane_runs_on) {
    addError(
      result,
      "platform",
      "control_plane_runs_on",
      "Control plane location must be specified for regions structure",
      "critical",
      "Add control_plane_runs_on with region and zone"
    );
  } else {
    // Validate the referenced region/zone exists
    const cpRegion = normalized.regions?.find(r => r.name === normalized.control_plane_runs_on?.region);
    if (!cpRegion) {
      addError(
        result,
        "platform",
        "control_plane_runs_on.region",
        `Region "${normalized.control_plane_runs_on.region}" not found`,
        "critical"
      );
    } else {
      const cpZone = cpRegion.zones.find(z => z.name === normalized.control_plane_runs_on?.zone);
      if (!cpZone) {
        addError(
          result,
          "platform",
          "control_plane_runs_on.zone",
          `Zone "${normalized.control_plane_runs_on.zone}" not found in region "${normalized.control_plane_runs_on.region}"`,
          "critical"
        );
      }
    }
  }

  // Validate global services
  validateGlobalServices(normalized, context, result, tier, platformDir, envVars);

  // Validate each region
  for (const region of normalized.regions || []) {
    validateRegion(region, context, result, tier, platformDir, envVars, haReqs);
  }

  // Validate hub is present for production/enterprise
  if (haReqs.hub_required) {
    const hasHub = normalized.regions?.some(r => r.hub !== undefined);
    if (!hasHub) {
      addError(
        result,
        "platform",
        "hub",
        `Hub (backup infrastructure) is required for ${tier} tier`,
        "critical",
        "Add a hub configuration with PBS and MinIO for backups"
      );
    }
  }
}

/**
 * Validates global services (unique across all regions)
 */
function validateGlobalServices(
  normalized: NormalizedInfrastructure,
  context: ValidationContext,
  result: ValidationResult,
  tier: InfrastructureTierType,
  platformDir: string,
  envVars: Map<string, string>
): void {
  // Validate global compute (VMs for Keycloak, Vault, etc.)
  if (normalized.compute) {
    validateCompute(normalized.compute, context, result, tier);
    validateAllSecrets(normalized.compute, "compute", "", platformDir, envVars, result);

    // Validate mandatory global VMs by tier
    validateMandatoryGlobalVMs(normalized.compute, result, tier);
  } else if (tier !== "local") {
    addError(
      result,
      "platform",
      "compute",
      `Global compute configuration is required for ${tier} tier`,
      "critical",
      "Add core-compute.yaml with global VMs (Keycloak, Vault, PostgreSQL, etc.)"
    );
  }

  // Validate global database (PostgreSQL)
  if (normalized.database) {
    validateDatabases(normalized.database, context, result, tier);
    validateAllSecrets(normalized.database, "database", "", platformDir, envVars, result);
  } else if (tier !== "local") {
    addError(
      result,
      "platform",
      "database",
      `Global database configuration is required for ${tier} tier`,
      "critical",
      "Add core-database.yaml with PostgreSQL cluster"
    );
  }

  // Validate networking (Headscale, PowerDNS)
  if (normalized.networking) {
    validateNetworking(normalized.networking, context, result, tier);
    validateAllSecrets(normalized.networking, "networking", "", platformDir, envVars, result);
  } else if (tier !== "local") {
    addError(
      result,
      "platform",
      "networking",
      `Global networking configuration is required for ${tier} tier`,
      "critical",
      "Add networking.yaml with Headscale and PowerDNS"
    );
  }
}

/**
 * Validates mandatory global VMs based on tier
 */
function validateMandatoryGlobalVMs(
  compute: ComputeConfig,
  result: ValidationResult,
  tier: InfrastructureTierType
): void {
  const vms = compute.virtual_machines || [];

  // Build role count map
  const roleCountMap = new Map<string, number>();
  vms.forEach((vm) => {
    if (vm.role) {
      roleCountMap.set(vm.role, (roleCountMap.get(vm.role) || 0) + 1);
    }
  });

  // Check global services (deployed_on: "global")
  const globalServices = Object.entries(INFRASTRUCTURE_REQUIREMENTS.vms)
    .filter(([_, req]) => req.deployed_on === "global");

  for (const [vmKey, vmReq] of globalServices) {
    const minCount = vmReq.min_count[tier];
    const currentCount = roleCountMap.get(vmReq.role) || 0;

    if (minCount > 0 && currentCount < minCount) {
      if (tier === "local") {
        addWarning(
          result,
          "compute",
          `global.${vmKey}`,
          `${tier} tier recommends at least ${minCount} ${vmKey} VM(s) (role: ${vmReq.role}), found ${currentCount}`,
          `Add ${minCount - currentCount} more VM(s) with role "${vmReq.role}"`
        );
      } else {
        addError(
          result,
          "compute",
          `global.${vmKey}`,
          `${tier} tier requires at least ${minCount} ${vmKey} VM(s) (role: ${vmReq.role}), found ${currentCount}`,
          "critical",
          `Add ${minCount - currentCount} more VM(s) with role "${vmReq.role}"`
        );
      }
    }
  }
}

/**
 * Validates a single region
 */
function validateRegion(
  region: NormalizedRegion,
  context: ValidationContext,
  result: ValidationResult,
  tier: InfrastructureTierType,
  platformDir: string,
  envVars: Map<string, string>,
  haReqs: typeof HA_REQUIREMENTS[keyof typeof HA_REQUIREMENTS]
): void {
  const regionPrefix = `region[${region.name}]`;

  // Validate deployed_on references a valid zone
  if (!region.deployed_on) {
    addError(
      result,
      "region",
      `${regionPrefix}.deployed_on`,
      "Region must specify where regional VMs are deployed",
      "critical",
      "Add deployed_on with a zone name"
    );
  } else {
    const deployZone = region.zones.find(z => z.name === region.deployed_on);
    if (!deployZone) {
      addError(
        result,
        "region",
        `${regionPrefix}.deployed_on`,
        `Zone "${region.deployed_on}" not found in region "${region.name}"`,
        "critical"
      );
    }
  }

  // Validate regional compute (Prometheus, Loki, etc.)
  if (region.compute) {
    validateRegionalVMs(region.compute, result, tier, region.name);
  } else if (tier !== "local") {
    addWarning(
      result,
      "region",
      `${regionPrefix}.compute`,
      `Regional compute configuration recommended for ${tier} tier`,
      "Add regional VMs for Prometheus, Loki, Alertmanager"
    );
  }

  // Validate hub (backup infrastructure)
  if (region.hub) {
    validateHub(region.hub, result, tier, region.name);
  }

  // Validate zones
  if (!region.zones || region.zones.length === 0) {
    addError(
      result,
      "region",
      `${regionPrefix}.zones`,
      "Region must have at least one zone",
      "critical"
    );
  } else {
    for (const zone of region.zones) {
      validateZone(zone, context, result, tier, region.name, platformDir, envVars);
    }
  }
}

/**
 * Validates regional VMs (Prometheus, Loki, etc.)
 */
function validateRegionalVMs(
  compute: ComputeConfig,
  result: ValidationResult,
  tier: InfrastructureTierType,
  regionName: string
): void {
  const vms = compute.virtual_machines || [];

  // Build role count map
  const roleCountMap = new Map<string, number>();
  vms.forEach((vm) => {
    if (vm.role) {
      roleCountMap.set(vm.role, (roleCountMap.get(vm.role) || 0) + 1);
    }
  });

  // Check regional services (deployed_on: "region")
  const regionalServices = Object.entries(INFRASTRUCTURE_REQUIREMENTS.vms)
    .filter(([_, req]) => req.deployed_on === "region");

  for (const [vmKey, vmReq] of regionalServices) {
    const minCount = vmReq.min_count[tier];
    const currentCount = roleCountMap.get(vmReq.role) || 0;

    if (minCount > 0 && currentCount < minCount) {
      if (tier === "local") {
        addWarning(
          result,
          "region",
          `region[${regionName}].${vmKey}`,
          `${tier} tier recommends at least ${minCount} ${vmKey} VM(s) per region, found ${currentCount}`,
          `Add ${minCount - currentCount} more VM(s) with role "${vmReq.role}"`
        );
      } else {
        addError(
          result,
          "region",
          `region[${regionName}].${vmKey}`,
          `${tier} tier requires at least ${minCount} ${vmKey} VM(s) per region, found ${currentCount}`,
          "error",
          `Add ${minCount - currentCount} more VM(s) with role "${vmReq.role}"`
        );
      }
    }
  }
}

/**
 * Validates hub (backup infrastructure)
 */
function validateHub(
  hub: NormalizedHub,
  result: ValidationResult,
  tier: InfrastructureTierType,
  regionName: string
): void {
  if (!hub) return;

  const hubPrefix = `region[${regionName}].hub`;

  // Validate hub compute (PBS, MinIO)
  if (hub.compute) {
    const vms = hub.compute.virtual_machines || [];

    // Build role count map
    const roleCountMap = new Map<string, number>();
    vms.forEach((vm) => {
      if (vm.role) {
        roleCountMap.set(vm.role, (roleCountMap.get(vm.role) || 0) + 1);
      }
    });

    // Check hub services (deployed_on: "hub")
    const hubServices = Object.entries(INFRASTRUCTURE_REQUIREMENTS.vms)
      .filter(([_, req]) => req.deployed_on === "hub");

    for (const [vmKey, vmReq] of hubServices) {
      const minCount = vmReq.min_count[tier];
      const currentCount = roleCountMap.get(vmReq.role) || 0;

      if (minCount > 0 && currentCount < minCount) {
        if (tier === "local") {
          addWarning(
            result,
            "hub",
            `${hubPrefix}.${vmKey}`,
            `${tier} tier recommends ${minCount} ${vmKey} VM(s) in hub, found ${currentCount}`,
            `Add ${minCount - currentCount} more VM(s) with role "${vmReq.role}"`
          );
        } else {
          addError(
            result,
            "hub",
            `${hubPrefix}.${vmKey}`,
            `${tier} tier requires ${minCount} ${vmKey} VM(s) in hub, found ${currentCount}`,
            "error",
            `Add ${minCount - currentCount} more VM(s) with role "${vmReq.role}"`
          );
        }
      }
    }
  } else if (tier !== "local") {
    addWarning(
      result,
      "hub",
      `${hubPrefix}.compute`,
      "Hub compute configuration recommended",
      "Add PBS and MinIO VMs for backup infrastructure"
    );
  }
}

/**
 * Validates a single zone
 */
function validateZone(
  zone: NormalizedZone,
  context: ValidationContext,
  result: ValidationResult,
  tier: InfrastructureTierType,
  regionName: string,
  platformDir: string,
  envVars: Map<string, string>
): void {
  if (!zone) return;

  const zonePrefix = `region[${regionName}].zone[${zone.name}]`;

  // Validate datacenter config
  if (zone.datacenter) {
    validateDatacenter(zone.datacenter, context, result, tier, envVars);
    validateAllSecrets(zone.datacenter, "datacenter", zonePrefix, platformDir, envVars, result);
  } else if (tier !== "local") {
    addError(
      result,
      "zone",
      `${zonePrefix}.datacenter`,
      `Datacenter configuration is required for ${tier} tier`,
      "critical",
      "Add datacenter.yaml with Proxmox server configuration"
    );
  }

  // Validate zone networking (VyOS, HAProxy)
  if (zone.networking) {
    validateNetworking(zone.networking, context, result, tier);
    validateAllSecrets(zone.networking, "networking", zonePrefix, platformDir, envVars, result);
  } else if (tier !== "local") {
    addError(
      result,
      "zone",
      `${zonePrefix}.networking`,
      `Zone networking configuration is required for ${tier} tier`,
      "critical",
      "Add networking.yaml with VyOS firewall configuration"
    );
  }

  // Validate zone compute (VyOS, HAProxy VMs)
  if (zone.compute) {
    validateZoneVMs(zone.compute, result, tier, regionName, zone.name);
  }
}

/**
 * Validates zone-level VMs (VyOS, HAProxy)
 */
function validateZoneVMs(
  compute: ComputeConfig,
  result: ValidationResult,
  tier: InfrastructureTierType,
  regionName: string,
  zoneName: string
): void {
  const vms = compute.virtual_machines || [];

  // Build role count map
  const roleCountMap = new Map<string, number>();
  vms.forEach((vm) => {
    if (vm.role) {
      roleCountMap.set(vm.role, (roleCountMap.get(vm.role) || 0) + 1);
    }
  });

  // Check zone services (deployed_on: "zone")
  const zoneServices = Object.entries(INFRASTRUCTURE_REQUIREMENTS.vms)
    .filter(([_, req]) => req.deployed_on === "zone");

  for (const [vmKey, vmReq] of zoneServices) {
    const minCount = vmReq.min_count[tier];
    const currentCount = roleCountMap.get(vmReq.role) || 0;

    if (minCount > 0 && currentCount < minCount) {
      if (tier === "local") {
        addWarning(
          result,
          "zone",
          `region[${regionName}].zone[${zoneName}].${vmKey}`,
          `${tier} tier recommends at least ${minCount} ${vmKey} VM(s) per zone, found ${currentCount}`,
          `Add ${minCount - currentCount} more VM(s) with role "${vmReq.role}"`
        );
      } else {
        addError(
          result,
          "zone",
          `region[${regionName}].zone[${zoneName}].${vmKey}`,
          `${tier} tier requires at least ${minCount} ${vmKey} VM(s) per zone, found ${currentCount}`,
          "error",
          `Add ${minCount - currentCount} more VM(s) with role "${vmReq.role}"`
        );
      }
    }
  }
}

/**
 * Validates layers for a datacenter (legacy mode)
 */
function validateDatacenterLayers(
  dcName: string,
  layers: {
    datacenter?: any;
    networking?: any;
    security?: any;
    compute?: any;
    database?: any;
    k8s?: any;
  },
  context: ValidationContext,
  result: ValidationResult,
  tier: InfrastructureTierType,
  platformDir: string,
  envVars: Map<string, string>
): void {
  const prefix = dcName === "default" ? "" : `dc[${dcName}].`;

  // Validate mandatory layers for non-local tiers
  if (tier !== "local") {
    if (!layers.datacenter) {
      addError(
        result,
        "platform",
        `${prefix}datacenter`,
        `Datacenter layer is mandatory for ${tier} tier`,
        "critical",
        "Add datacenter.yaml with physical server configuration"
      );
    }

    if (!layers.networking?.firewall?.enabled) {
      addError(
        result,
        "platform",
        `${prefix}networking.firewall`,
        `Firewall must be enabled for ${tier} tier`,
        "critical",
        "Enable firewall in networking.yaml"
      );
    }

    if (!layers.networking?.vpn?.enabled) {
      addError(
        result,
        "platform",
        `${prefix}networking.vpn`,
        `VPN must be enabled for ${tier} tier`,
        "critical",
        "Enable VPN (Headscale) in networking.yaml"
      );
    }

    if (!layers.compute || (layers.compute.virtual_machines || []).length === 0) {
      addError(
        result,
        "platform",
        `${prefix}compute`,
        `Compute layer with VMs is mandatory for ${tier} tier`,
        "critical",
        "Add compute configuration with VMs"
      );
    }
  }

  // Validate each layer
  if (layers.datacenter) {
    validateDatacenter(layers.datacenter, context, result, tier, envVars);
    validateAllSecrets(layers.datacenter, "datacenter", prefix, platformDir, envVars, result);
  }

  if (layers.networking) {
    validateNetworking(layers.networking, context, result, tier);
    validateAllSecrets(layers.networking, "networking", prefix, platformDir, envVars, result);
  }

  if (layers.compute) {
    validateCompute(layers.compute, context, result, tier);
    validateAllSecrets(layers.compute, "compute", prefix, platformDir, envVars, result);
  }

  if (layers.database) {
    validateDatabases(layers.database, context, result, tier);
    validateAllSecrets(layers.database, "database", prefix, platformDir, envVars, result);
  }

  if (layers.k8s) {
    validateCluster(layers.k8s, context, result, tier);
    validateAllSecrets(layers.k8s, "cluster", prefix, platformDir, envVars, result);
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
