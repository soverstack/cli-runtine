import { Bastion, InfrastructureTierType } from "../../../types";
import { ValidationResult, ValidationContext, addError, addWarning } from "../utils/types";
import { validateVmIdRange, validateVmIdUniqueness } from "../rules/vm-id-ranges";
import { validateMinimumNodes } from "../rules/ha-requirements";
import { validateIpFormat, validateCidrFormat, validateBastionOidc } from "../rules/security";

/**
 * Validates bastion configuration
 */
export function validateBastion(
  bastion: Bastion,
  context: ValidationContext,
  result: ValidationResult,
  infrastructureTier: InfrastructureTierType
): void {
  const layer = "bastion";

  // Check if bastion is enabled
  if (!bastion.enabled && !bastion.enabled) {
    // Bastion is disabled, skip validation
    return;
  }

  // Validate type
  if (!bastion.type) {
    addError(result, layer, "type", "Bastion type is required", "error");
  } else if (!["wireguard", "headscale", "netbird"].includes(bastion.type)) {
    addError(
      result,
      layer,
      "type",
      `Invalid bastion type: ${bastion.type}`,
      "error",
      'Must be one of: "headscale", "wireguard", "netbird"'
    );
  } else if (bastion.type !== "headscale") {
    addWarning(
      result,
      layer,
      "type",
      `${bastion.type} support is planned but not yet available. Currently only "headscale" is supported.`,
      'Use type: "headscale" for now'
    );
  }

  // Validate public IP
  if (!bastion.public_ip) {
    addError(
      result,
      layer,
      "public_ip",
      "Public IP is required for bastion",
      "critical",
      "Assign a public IP from your failover subnet for VPN access"
    );
  } else {
    validateIpFormat(bastion.public_ip, "public_ip", result, layer);
  }

  // Validate VM configuration
  if (!bastion.vm_configuration) {
    addError(result, layer, "vm_configuration", "VM configuration is required", "critical");
    return;
  }

  // Validate VM IDs
  if (!bastion.vm_configuration.vm_ids || bastion.vm_configuration.vm_ids.length === 0) {
    addError(
      result,
      layer,
      "vm_configuration.vm_ids",
      "At least one VM ID is required",
      "critical"
    );
  } else {
    // HA requirement: at least 2 VMs
    validateMinimumNodes(
      bastion.vm_configuration.vm_ids,
      2,
      "Bastion",
      result,
      layer,
      "vm_configuration.vm_ids",
      infrastructureTier
    );

    // Validate each VM ID
    bastion.vm_configuration.vm_ids.forEach((vmId, index) => {
      const vmName = `bastion-vm-${index + 1}`;

      // Validate ID range (200-299)
      validateVmIdRange(vmId, "bastion", vmName, result, layer);

      // Validate uniqueness
      validateVmIdUniqueness(vmId, vmName, context, result, layer);
    });
  }

  // Validate OS template
  if (!bastion.vm_configuration.os_template) {
    addError(result, layer, "vm_configuration.os_template", "OS template is required", "error");
  } else {
    // Headscale works best with Debian
    if (!bastion.vm_configuration.os_template.includes("debian")) {
      addWarning(
        result,
        layer,
        "vm_configuration.os_template",
        `Headscale/Bastion is recommended to run on Debian. You're using: ${bastion.vm_configuration.os_template}`,
        'Consider using "debian-12-cloudinit" for better compatibility'
      );
    }
  }

  // Validate VPN subnet
  if (bastion.vpn_subnet) {
    validateCidrFormat(bastion.vpn_subnet, "vpn_subnet", result, layer);
  } else {
    addWarning(
      result,
      layer,
      "vpn_subnet",
      "VPN subnet not configured",
      'Add a VPN subnet (e.g., "100.64.0.0/10") for the Headscale/Tailscale network'
    );
  }

  // Validate OIDC enforcement (CRITICAL)
  validateBastionOidc(bastion.oidc_enforced, result, layer);

  // Validate database type
  if (!bastion.database_type) {
    addError(
      result,
      layer,
      "database_type",
      "Database type is required",
      "error",
      'Choose either "postgres" or "sqlite"'
    );
  } else if (!["sqlite", "postgres"].includes(bastion.database_type)) {
    addError(
      result,
      layer,
      "database_type",
      `Invalid database_type: ${bastion.database_type}`,
      "error",
      'Must be "sqlite" or "postgres"'
    );
  } else if (bastion.database_type === "sqlite") {
    addWarning(
      result,
      layer,
      "database_type",
      "SQLite is not recommended for production with >100 users",
      'Consider using "postgres" for better scalability and HA'
    );
  }
}
