import { ComputeConfig, InfrastructureTierType, VMBasedOnType, VMCustom, VMRole } from "../../../types";
import { ValidationResult, ValidationContext, addError, addWarning } from "../utils/types";
import { validateVmIdRange, validateVmIdUniqueness } from "../rules/vm-id-ranges";
import { validateResourceConstraints } from "../rules/ha-requirements";
import {
  INFRASTRUCTURE_REQUIREMENTS,
  VMRequirementKey,
  getVMIdRangeForRole,
  isVMIdValidForRole
} from "../../../infrastructure-requirements";

/**
 * Validates compute configuration
 */
export function validateCompute(
  compute: ComputeConfig,
  context: ValidationContext,
  result: ValidationResult,
  infrastructureTier: InfrastructureTierType
): void {
  const layer = "compute";

  // Validate type definitions
  if (!compute.instance_type_definitions || compute.instance_type_definitions.length === 0) {
    addWarning(
      result,
      layer,
      "instance_type_definitions",
      "No compute type definitions found",
      "Consider defining reusable VM types for consistency"
    );
  } else {
    const typeNames = new Set<string>();

    compute.instance_type_definitions.forEach((typeDef, index) => {
      const typeField = `instance_type_definitions[${index}]`;

      // Validate required fields
      if (!typeDef.name) {
        addError(result, layer, `${typeField}.name`, "Type name is required", "error");
      } else {
        // Check for duplicates
        if (typeNames.has(typeDef.name)) {
          addError(
            result,
            layer,
            `${typeField}.name`,
            `Duplicate type definition name: ${typeDef.name}`,
            "error"
          );
        } else {
          typeNames.add(typeDef.name);
        }
      }

      if (!typeDef.cpu || typeDef.cpu <= 0) {
        addError(result, layer, `${typeField}.cpu`, "CPU must be > 0", "error");
      }

      if (!typeDef.ram || typeDef.ram <= 0) {
        addError(result, layer, `${typeField}.ram`, "RAM must be > 0", "error");
      }

      if (!typeDef.disk || typeDef.disk <= 0) {
        addError(result, layer, `${typeField}.disk`, "Disk size must be > 0", "error");
      }

      if (!typeDef.os_template) {
        addError(result, layer, `${typeField}.os_template`, "OS template is required", "error");
      }

      if (!typeDef.disk_type) {
        addError(
          result,
          layer,
          `${typeField}.disk_type`,
          "Disk type is required (distributed or local)",
          "error"
        );
      } else if (typeDef.disk_type !== "distributed" && typeDef.disk_type !== "local") {
        addError(
          result,
          layer,
          `${typeField}.disk_type`,
          `Invalid disk_type: ${typeDef.disk_type}. Must be 'distributed' or 'local'`,
          "error"
        );
      }
    });
  }

  // Validate virtual machines
  if (!compute.virtual_machines || compute.virtual_machines.length === 0) {
    addError(
      result,
      layer,
      "virtual_machines",
      "At least one virtual machine is required",
      "critical",
      "Add VM configurations to deploy infrastructure"
    );
    return;
  }

  const typeNames = new Set(compute.instance_type_definitions?.map((t) => t.name) || []);

  compute.virtual_machines.forEach((vm, index) => {
    const vmField = `virtual_machines[${index}]`;

    // Validate required base fields
    if (!vm.name) {
      addError(result, layer, `${vmField}.name`, "VM name is required", "error");
      return;
    }

    if (!vm.vm_id) {
      addError(result, layer, `${vmField}.vm_id`, "VM ID is required", "error");
      return;
    }

    if (!vm.host) {
      addError(result, layer, `${vmField}.host`, "Host (Proxmox node) is required", "error");
    } else {
      context.host_names.add(vm.host);
    }

    if (!vm.role) {
      addError(result, layer, `${vmField}.role`, "VM role is required", "error");
      return;
    }

    // Validate VM ID range and uniqueness
    validateVmIdRange(vm.vm_id, vm.role, vm.name, result, layer);
    validateVmIdUniqueness(vm.vm_id, vm.name, context, result, layer);

    // Type-specific validation
    if ("type_definition" in vm) {
      // VM based on type definition
      const vmTyped = vm as VMBasedOnType;

      if (!vmTyped.type_definition) {
        addError(
          result,
          layer,
          `${vmField}.type_definition`,
          "Type definition name is required",
          "error"
        );
      } else if (!typeNames.has(vmTyped.type_definition)) {
        addError(
          result,
          layer,
          `${vmField}.type_definition`,
          `Type definition "${vmTyped.type_definition}" not found`,
          "error",
          `Available types: ${Array.from(typeNames).join(", ") || "none"}`
        );
      } else {
        // Get the type definition and validate resources
        const typeDef = compute.instance_type_definitions?.find(
          (t) => t.name === vmTyped.type_definition
        );

        if (typeDef) {
          validateResourceConstraints(vm.name, vm.role, typeDef.cpu, typeDef.ram, result, layer, infrastructureTier);
        }
      }
    } else {
      // Custom VM with explicit specs
      const vmCustom = vm as VMCustom;

      // CRITICAL: Reject VMCustom in production/enterprise tiers
      if (infrastructureTier !== "local") {
        addError(
          result,
          layer,
          `${vmField}`,
          `VMCustom not allowed in ${infrastructureTier} tier - use instance_type_definitions`,
          "critical",
          `Define a type in instance_type_definitions and use type_definition property instead of inline cpu/ram/disk`
        );
      }

      if (!vmCustom.cpu || vmCustom.cpu <= 0) {
        addError(result, layer, `${vmField}.cpu`, "CPU must be > 0", "error");
      }

      if (!vmCustom.ram || vmCustom.ram <= 0) {
        addError(result, layer, `${vmField}.ram`, "RAM must be > 0", "error");
      }

      if (!vmCustom.disk || vmCustom.disk <= 0) {
        addError(result, layer, `${vmField}.disk`, "Disk size must be > 0", "error");
      }

      if (!vmCustom.os_template) {
        addError(result, layer, `${vmField}.os_template`, "OS template is required", "error");
      }

      if (!vmCustom.disk_type) {
        addError(
          result,
          layer,
          `${vmField}.disk_type`,
          "Disk type is required (distributed or local)",
          "error"
        );
      }

      // Validate resources
      validateResourceConstraints(vm.name, vm.role, vmCustom.cpu, vmCustom.ram, result, layer, infrastructureTier);
    }

    // Validate public IP format if present
    if (vm.public_ip) {
      const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
      if (!ipRegex.test(vm.public_ip)) {
        addError(
          result,
          layer,
          `${vmField}.public_ip`,
          `Invalid IP format: ${vm.public_ip}`,
          "error"
        );
      }
    }
  });

  // Validate linux containers if present
  if (compute.linux_containers && compute.linux_containers.length > 0) {
    compute.linux_containers.forEach((container, index) => {
      const containerField = `linux_containers[${index}]`;

      if (!container.name) {
        addError(result, layer, `${containerField}.name`, "Container name is required", "error");
      }

      if (!container.vm_id) {
        addError(result, layer, `${containerField}.vm_id`, "Container ID is required", "error");
      } else {
        validateVmIdUniqueness(container.vm_id, container.name, context, result, layer);
      }
    });
  }

  // =========================================================================
  // INFRASTRUCTURE REQUIREMENTS VALIDATION
  // =========================================================================
  validateInfrastructureRequirements(compute, result, layer, infrastructureTier);
}

/**
 * Validates that infrastructure meets the requirements for the tier
 * - Checks mandatory VMs are present with minimum counts
 * - Validates VM ID ranges match roles
 * - Validates resource specs meet minimum requirements
 */
function validateInfrastructureRequirements(
  compute: ComputeConfig,
  result: ValidationResult,
  layer: string,
  tier: InfrastructureTierType
): void {
  const vms = compute.virtual_machines || [];
  const typeDefs = compute.instance_type_definitions || [];

  // Build a map of role -> count
  const roleCountMap = new Map<string, number>();
  vms.forEach((vm) => {
    if (vm.role) {
      roleCountMap.set(vm.role, (roleCountMap.get(vm.role) || 0) + 1);
    }
  });

  // Check mandatory VMs by tier
  for (const [vmKey, vmReq] of Object.entries(INFRASTRUCTURE_REQUIREMENTS.vms)) {
    const minCount = vmReq.min_count[tier];
    const currentCount = roleCountMap.get(vmReq.role) || 0;

    if (minCount > 0 && currentCount < minCount) {
      if (tier === "local") {
        addWarning(
          result,
          layer,
          `infrastructure.${vmKey}`,
          `${tier} tier recommends at least ${minCount} ${vmKey} VM(s) (role: ${vmReq.role}), found ${currentCount}`,
          `Add ${minCount - currentCount} more VM(s) with role "${vmReq.role}" for HA`
        );
      } else {
        addError(
          result,
          layer,
          `infrastructure.${vmKey}`,
          `${tier} tier requires at least ${minCount} ${vmKey} VM(s) (role: ${vmReq.role}), found ${currentCount}`,
          "critical",
          `Add ${minCount - currentCount} more VM(s) with role "${vmReq.role}"`
        );
      }
    }
  }

  // Validate each VM's ID is in the correct range for its role
  vms.forEach((vm, index) => {
    if (vm.vm_id && vm.role) {
      if (!isVMIdValidForRole(vm.vm_id, vm.role)) {
        const expectedRange = getVMIdRangeForRole(vm.role);
        addError(
          result,
          layer,
          `virtual_machines[${index}].vm_id`,
          `VM ID ${vm.vm_id} is not in valid range for role "${vm.role}"`,
          "error",
          expectedRange
            ? `Expected range: ${expectedRange.min}-${expectedRange.max}`
            : `Unknown role "${vm.role}"`
        );
      }
    }
  });

  // Validate resource specs for VMs match tier requirements
  vms.forEach((vm, index) => {
    if (!vm.role) return;

    // Find the requirement for this role
    const reqEntry = Object.entries(INFRASTRUCTURE_REQUIREMENTS.vms).find(
      ([_, req]) => req.role === vm.role
    );
    if (!reqEntry) return;

    const [vmKey, vmReq] = reqEntry;
    const requiredSpecs = vmReq.specs[tier];

    let actualCpu: number | undefined;
    let actualRam: number | undefined;
    let actualDisk: number | undefined;

    if ("type_definition" in vm) {
      // Get specs from type definition
      const typeDef = typeDefs.find((t) => t.name === (vm as VMBasedOnType).type_definition);
      if (typeDef) {
        actualCpu = typeDef.cpu;
        actualRam = typeDef.ram;
        actualDisk = typeDef.disk;
      }
    } else {
      // Custom VM specs
      const vmCustom = vm as VMCustom;
      actualCpu = vmCustom.cpu;
      actualRam = vmCustom.ram;
      actualDisk = vmCustom.disk;
    }

    if (actualCpu !== undefined && actualCpu < requiredSpecs.vcpu) {
      addWarning(
        result,
        layer,
        `virtual_machines[${index}].cpu`,
        `VM "${vm.name}" has ${actualCpu} vCPU but ${tier} tier recommends ${requiredSpecs.vcpu} for ${vmKey}`,
        `Consider increasing CPU to ${requiredSpecs.vcpu}`
      );
    }

    if (actualRam !== undefined && actualRam < requiredSpecs.ram_gb) {
      addWarning(
        result,
        layer,
        `virtual_machines[${index}].ram`,
        `VM "${vm.name}" has ${actualRam}GB RAM but ${tier} tier recommends ${requiredSpecs.ram_gb}GB for ${vmKey}`,
        `Consider increasing RAM to ${requiredSpecs.ram_gb}GB`
      );
    }

    if (actualDisk !== undefined && actualDisk < requiredSpecs.disk_gb) {
      addWarning(
        result,
        layer,
        `virtual_machines[${index}].disk`,
        `VM "${vm.name}" has ${actualDisk}GB disk but ${tier} tier recommends ${requiredSpecs.disk_gb}GB for ${vmKey}`,
        `Consider increasing disk to ${requiredSpecs.disk_gb}GB`
      );
    }
  });

  // Validate mandatory databases - these are required for core services
  if (tier !== "local") {
    validateMandatoryDatabases(vms, result, layer, tier);
  }
}

/**
 * Validates that mandatory databases are configured for core services
 * Required databases: keycloak, headscale, powerdns, openbao
 */
function validateMandatoryDatabases(
  vms: ComputeConfig["virtual_machines"],
  result: ValidationResult,
  layer: string,
  tier: InfrastructureTierType
): void {
  // Check for PostgreSQL VMs (role: database)
  const dbVMs = vms.filter((vm) => vm.role === "database");

  if (dbVMs.length === 0) {
    addError(
      result,
      layer,
      "infrastructure.postgresql",
      `${tier} tier requires at least one PostgreSQL VM for mandatory databases`,
      "critical",
      "Add VM(s) with role 'database' for PostgreSQL"
    );
    return;
  }

  // List mandatory databases for documentation/warning
  const mandatoryDbs = INFRASTRUCTURE_REQUIREMENTS.mandatory_databases;
  addWarning(
    result,
    layer,
    "mandatory_databases",
    `Ensure PostgreSQL VMs are configured with the following mandatory databases: ${mandatoryDbs.map((db) => db.name).join(", ")}`,
    `These databases are required for: ${mandatoryDbs.map((db) => `${db.name} (${db.purpose})`).join("; ")}`
  );
}
