import { IdentityProvider, InfrastructureTierType } from "../../../types";
import { ValidationResult, ValidationContext, addError, addWarning } from "../utils/types";
import { validateVmIdRange, validateVmIdUniqueness } from "../rules/vm-id-ranges";
import { validateMinimumNodes } from "../rules/ha-requirements";
import { validateIpFormat } from "../rules/security";

/**
 * Validates IAM (Identity Provider) configuration
 */
export function validateIAM(
  iam: IdentityProvider,
  context: ValidationContext,
  result: ValidationResult,
  infrastructureTier: InfrastructureTierType
): void {
  const layer = "iam";

  // CRITICAL: IAM is mandatory for production and enterprise tiers
  if (!iam.enabled) {
    if (infrastructureTier === "production" || infrastructureTier === "enterprise") {
      addError(
        result,
        layer,
        "enabled",
        `IAM cannot be disabled for ${infrastructureTier} tier`,
        "critical",
        "IAM is mandatory for production and enterprise environments. Set enabled: true"
      );
      return;
    }
    // IAM is disabled for local tier, skip validation
    return;
  }

  // Validate type
  if (!iam.type) {
    addError(result, layer, "type", "IAM type is required", "error");
  } else if (!["keycloak", "authentik"].includes(iam.type)) {
    addError(
      result,
      layer,
      "type",
      `Invalid IAM type: ${iam.type}`,
      "error",
      'Must be one of: "keycloak", "authentik"'
    );
  } else if (iam.type !== "keycloak") {
    addWarning(
      result,
      layer,
      "type",
      `${iam.type} support is planned but not yet available. Currently only "keycloak" is supported.`,
      'Use type: "keycloak" for now'
    );
  }

  // Validate public IP
  if (!iam.public_ip) {
    addError(
      result,
      layer,
      "public_ip",
      "Public IP is required for IAM",
      "critical",
      "Assign a public IP from your failover subnet for IAM access"
    );
  } else {
    validateIpFormat(iam.public_ip, "public_ip", result, layer);
  }

  // Validate domain
  if (!iam.domain) {
    addError(
      result,
      layer,
      "domain",
      "Domain is required for IAM",
      "critical",
      "Configure a domain for IAM services (e.g., auth.example.com)"
    );
  } else {
    // Basic domain validation
    const domainPattern = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/i;
    if (!domainPattern.test(iam.domain)) {
      addError(
        result,
        layer,
        "domain",
        `Invalid domain format: ${iam.domain}`,
        "error",
        "Use a valid domain name (e.g., auth.example.com)"
      );
    }
  }

  // Validate VM configuration
  if (!iam.vm_configuration) {
    addError(result, layer, "vm_configuration", "VM configuration is required", "critical");
    return;
  }

  // Validate VM IDs
  if (!iam.vm_configuration.vm_ids || iam.vm_configuration.vm_ids.length === 0) {
    addError(
      result,
      layer,
      "vm_configuration.vm_ids",
      "At least one VM ID is required",
      "critical"
    );
  } else {
    // HA requirement: at least 2 VMs for production/enterprise
    const minNodes = infrastructureTier === "local" ? 1 : 2;
    validateMinimumNodes(
      iam.vm_configuration.vm_ids,
      minNodes,
      "IAM",
      result,
      layer,
      "vm_configuration.vm_ids",
      infrastructureTier
    );

    // Validate each VM ID
    iam.vm_configuration.vm_ids.forEach((vmId, index) => {
      const vmName = `iam-vm-${index + 1}`;

      // Validate ID range (250-269 for IAM)
      if (vmId < 250 || vmId > 269) {
        addError(
          result,
          layer,
          "vm_configuration.vm_ids",
          `VM ID ${vmId} for ${vmName} is outside the reserved IAM range`,
          "error",
          "IAM VMs must use IDs 250-269. Choose an ID in this range."
        );
      }

      // Validate uniqueness
      validateVmIdUniqueness(vmId, vmName, context, result, layer);
    });
  }

  // Validate OS template
  if (!iam.vm_configuration.os_template) {
    addError(result, layer, "vm_configuration.os_template", "OS template is required", "error");
  } else {
    // Keycloak works best with Debian
    if (!iam.vm_configuration.os_template.includes("debian")) {
      addWarning(
        result,
        layer,
        "vm_configuration.os_template",
        `Keycloak/IAM is recommended to run on Debian. You're using: ${iam.vm_configuration.os_template}`,
        'Consider using "debian-12-cloudinit" for better compatibility'
      );
    }
  }
}
