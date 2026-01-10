import { Firewall, InfrastructureTierType } from "../../../types";
import { ValidationResult, ValidationContext, addError, addWarning } from "../utils/types";
import { validateVmIdRange, validateVmIdUniqueness } from "../rules/vm-id-ranges";
import { validateMinimumNodes } from "../rules/ha-requirements";
import { validateIpFormat } from "../rules/security";

/**
 * Validates firewall configuration
 */
export function validateFirewall(
  firewall: Firewall,
  context: ValidationContext,
  result: ValidationResult,
  infrastructureTier: InfrastructureTierType
): void {
  const layer = "firewall";

  // Check if firewall is enabled
  if (!firewall.enabled && !firewall.enabled) {
    // Firewall is disabled, skip validation
    return;
  }

  // Validate type
  if (!firewall.type) {
    addError(result, layer, "type", "Firewall type is required", "error");
  } else if (!["OPNsense", "pfSense", "vyos"].includes(firewall.type)) {
    addError(
      result,
      layer,
      "type",
      `Invalid firewall type: ${firewall.type}`,
      "error",
      'Must be one of: "OPNsense", "pfSense", "vyos"'
    );
  } else if (firewall.type !== "vyos") {
    addWarning(
      result,
      layer,
      "type",
      `${firewall.type} support is planned but not yet available. Currently only "vyos" is supported.`,
      'Use type: "vyos" for now'
    );
  }

  // Validate public IP
  if (!firewall.public_ip) {
    addError(
      result,
      layer,
      "public_ip",
      "Public IP is required for firewall",
      "critical",
      "Assign a public IP from your failover subnet"
    );
  } else {
    validateIpFormat(firewall.public_ip, "public_ip", result, layer);
  }

  // Validate VM configuration
  if (!firewall.vm_configuration) {
    addError(result, layer, "vm_configuration", "VM configuration is required", "critical");
    return;
  }

  // Validate VM IDs
  if (!firewall.vm_configuration.vm_ids || firewall.vm_configuration.vm_ids.length === 0) {
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
      firewall.vm_configuration.vm_ids,
      2,
      "Firewall",
      result,
      layer,
      "vm_configuration.vm_ids",
      infrastructureTier
    );

    // Validate each VM ID
    firewall.vm_configuration.vm_ids.forEach((vmId, index) => {
      const vmName = `firewall-vm-${index + 1}`;

      // Validate ID range (100-199)
      validateVmIdRange(vmId, "firewall", vmName, result, layer);

      // Validate uniqueness
      validateVmIdUniqueness(vmId, vmName, context, result, layer);
    });
  }

  // Validate OS template
  if (!firewall.vm_configuration.os_template) {
    addError(result, layer, "vm_configuration.os_template", "OS template is required", "error");
  } else {
    // VyOS works best with Debian
    if (firewall.type === "vyos" && !firewall.vm_configuration.os_template.includes("debian")) {
      addWarning(
        result,
        layer,
        "vm_configuration.os_template",
        `VyOS is typically deployed on Debian. You're using: ${firewall.vm_configuration.os_template}`,
        'Consider using "debian-12-cloudinit" for better compatibility'
      );
    }
  }
}
