import { ValidationResult, addError, addWarning, ValidationContext } from "../utils/types";
import { VMRole, InfrastructureTierType } from "../../../types";
import { VM_ID_RANGES as TYPE_VM_ID_RANGES } from "../../../constants";

// ═══════════════════════════════════════════════════════════════════════════
// VM ID RANGE VALIDATION RULES
// ═══════════════════════════════════════════════════════════════════════════
//
// RESERVED ID RANGES:
//   1-99:      EDGE          - VyOS, PowerDNS, dnsdist
//   100-199:   SECURITY      - Headscale, Teleport, Vault, CrowdSec
//   200-299:   IAM_DATA      - Keycloak, PostgreSQL
//   300-399:   OBSERVABILITY - Prometheus, Grafana, Loki, Alertmanager, Wazuh
//   400-499:   INFRA         - HAProxy, Soverstack
//   500-1999:  KUBERNETES    - Masters (500-599), Workers (600-1999)
//   2000-2999: BACKUP        - PBS, MinIO (Hub only)
//   3000+:     APPLICATIONS  - Custom apps
//
// ═══════════════════════════════════════════════════════════════════════════

interface VMIdRange {
  min: number;
  max: number;
  role: VMRole;
  description: string;
}

// Convert the TYPE_VM_ID_RANGES to the format used by validation (simplified by group)
export const VM_ID_RANGES: VMIdRange[] = [
  // Edge (1-99): Firewall, DNS
  { min: TYPE_VM_ID_RANGES.EDGE.min, max: TYPE_VM_ID_RANGES.EDGE.max, role: "firewall", description: "Edge (Firewall, DNS)" },
  { min: TYPE_VM_ID_RANGES.EDGE.min, max: TYPE_VM_ID_RANGES.EDGE.max, role: "dns_lb", description: "Edge (Firewall, DNS)" },
  { min: TYPE_VM_ID_RANGES.EDGE.min, max: TYPE_VM_ID_RANGES.EDGE.max, role: "dns_server", description: "Edge (Firewall, DNS)" },
  // Security (100-199): VPN, SSH, Secrets, IDS
  { min: TYPE_VM_ID_RANGES.SECURITY.min, max: TYPE_VM_ID_RANGES.SECURITY.max, role: "bastion", description: "Security" },
  { min: TYPE_VM_ID_RANGES.SECURITY.min, max: TYPE_VM_ID_RANGES.SECURITY.max, role: "ssh_bastion", description: "Security" },
  { min: TYPE_VM_ID_RANGES.SECURITY.min, max: TYPE_VM_ID_RANGES.SECURITY.max, role: "ids", description: "Security" },
  { min: TYPE_VM_ID_RANGES.SECURITY.min, max: TYPE_VM_ID_RANGES.SECURITY.max, role: "secrets", description: "Security" },
  // IAM & Data (200-299): Keycloak, PostgreSQL, Redis
  { min: TYPE_VM_ID_RANGES.IAM_DATA.min, max: TYPE_VM_ID_RANGES.IAM_DATA.max, role: "iam_sso", description: "IAM & Data" },
  { min: TYPE_VM_ID_RANGES.IAM_DATA.min, max: TYPE_VM_ID_RANGES.IAM_DATA.max, role: "database", description: "IAM & Data" },
  { min: TYPE_VM_ID_RANGES.IAM_DATA.min, max: TYPE_VM_ID_RANGES.IAM_DATA.max, role: "cache", description: "IAM & Data" },
  // Observability (300-399): Prometheus, Grafana, Loki, Wazuh
  { min: TYPE_VM_ID_RANGES.OBSERVABILITY.min, max: TYPE_VM_ID_RANGES.OBSERVABILITY.max, role: "monitoring", description: "Observability" },
  { min: TYPE_VM_ID_RANGES.OBSERVABILITY.min, max: TYPE_VM_ID_RANGES.OBSERVABILITY.max, role: "dashboards", description: "Observability" },
  { min: TYPE_VM_ID_RANGES.OBSERVABILITY.min, max: TYPE_VM_ID_RANGES.OBSERVABILITY.max, role: "logging", description: "Observability" },
  { min: TYPE_VM_ID_RANGES.OBSERVABILITY.min, max: TYPE_VM_ID_RANGES.OBSERVABILITY.max, role: "alerting", description: "Observability" },
  { min: TYPE_VM_ID_RANGES.OBSERVABILITY.min, max: TYPE_VM_ID_RANGES.OBSERVABILITY.max, role: "status_page", description: "Observability" },
  { min: TYPE_VM_ID_RANGES.OBSERVABILITY.min, max: TYPE_VM_ID_RANGES.OBSERVABILITY.max, role: "siem", description: "Observability" },
  // Infra (400-499): Load Balancer, Tools
  { min: TYPE_VM_ID_RANGES.INFRA.min, max: TYPE_VM_ID_RANGES.INFRA.max, role: "load_balancer", description: "Infra" },
  { min: TYPE_VM_ID_RANGES.INFRA.min, max: TYPE_VM_ID_RANGES.INFRA.max, role: "management", description: "Infra" },
  { min: TYPE_VM_ID_RANGES.INFRA.min, max: TYPE_VM_ID_RANGES.INFRA.max, role: "git_server", description: "Infra" },
  { min: TYPE_VM_ID_RANGES.INFRA.min, max: TYPE_VM_ID_RANGES.INFRA.max, role: "registry", description: "Infra" },
  { min: TYPE_VM_ID_RANGES.INFRA.min, max: TYPE_VM_ID_RANGES.INFRA.max, role: "pentest", description: "Infra" },
  { min: TYPE_VM_ID_RANGES.INFRA.min, max: TYPE_VM_ID_RANGES.INFRA.max, role: "ci_runner", description: "Infra" },
  // Kubernetes (500-1999): Masters 500-599, Workers 600-1999
  { min: 500, max: 599, role: "k8s_master", description: "K8s Masters" },
  { min: 600, max: 1999, role: "k8s_worker", description: "K8s Workers" },
  // Backup (1000-1999): PBS, MinIO
  { min: TYPE_VM_ID_RANGES.BACKUP.min, max: TYPE_VM_ID_RANGES.BACKUP.max, role: "backup_server", description: "Backup" },
  { min: TYPE_VM_ID_RANGES.BACKUP.min, max: TYPE_VM_ID_RANGES.BACKUP.max, role: "object_storage", description: "Backup" },
  // Applications (2000+)
  { min: TYPE_VM_ID_RANGES.APPLICATIONS.min, max: TYPE_VM_ID_RANGES.APPLICATIONS.max, role: "general_purpose", description: "Applications" },
];

/**
 * Gets the expected range for a role (simplified by group)
 */
export function getExpectedRangeForRole(role: VMRole | string): { min: number; max: number } | null {
  switch (role) {
    // EDGE (1-99): Firewall, DNS
    case "firewall":
    case "dns_lb":
    case "dns_server":
      return TYPE_VM_ID_RANGES.EDGE;

    // SECURITY (100-199): VPN, SSH, Secrets, IDS
    case "bastion":
    case "ssh_bastion":
    case "ids":
    case "secrets":
      return TYPE_VM_ID_RANGES.SECURITY;

    // IAM & DATA (200-299): Keycloak, PostgreSQL, Redis
    case "iam_sso":
    case "database":
    case "cache":
      return TYPE_VM_ID_RANGES.IAM_DATA;

    // OBSERVABILITY (300-399): Prometheus, Grafana, Loki, Wazuh
    case "monitoring":
    case "dashboards":
    case "logging":
    case "alerting":
    case "status_page":
    case "siem":
      return TYPE_VM_ID_RANGES.OBSERVABILITY;

    // INFRA (400-499): Load Balancer, Tools
    case "load_balancer":
    case "management":
    case "git_server":
    case "registry":
    case "pentest":
    case "ci_runner":
      return TYPE_VM_ID_RANGES.INFRA;

    // KUBERNETES (500-1999): Masters 500-599, Workers 600-1999
    case "k8s_master":
      return { min: 500, max: 599 };
    case "k8s_worker":
      return { min: 600, max: 1999 };

    // BACKUP (1000-1999): PBS, MinIO
    case "backup_server":
    case "object_storage":
      return TYPE_VM_ID_RANGES.BACKUP;

    // APPLICATIONS (2000+)
    case "general_purpose":
    default:
      return TYPE_VM_ID_RANGES.APPLICATIONS;
  }
}

/**
 * Validates that a VM ID is in the correct range for its role
 */
export function validateVmIdRange(
  vmId: number,
  role: VMRole | "firewall" | "bastion",
  vmName: string,
  result: ValidationResult,
  layer: string,
  infrastructureTier: InfrastructureTierType = "production"
): boolean {
  const expectedRange = getExpectedRangeForRole(role);

  if (!expectedRange) {
    return true; // No specific range requirement
  }

  if (vmId < expectedRange.min || vmId > expectedRange.max) {
    // For local tier, make it a warning
    if (infrastructureTier === "local") {
      addWarning(
        result,
        layer,
        `${vmName}.vm_id`,
        `VM ID ${vmId} for role "${role}" should be in range ${expectedRange.min}-${expectedRange.max}`,
        `Using non-standard ID ranges may cause confusion. Consider using the recommended range.`
      );
      return true;
    }

    addError(
      result,
      layer,
      `${vmName}.vm_id`,
      `VM ID ${vmId} for role "${role}" must be in range ${expectedRange.min}-${expectedRange.max}`,
      "error",
      `Change VM ID to be within the ${role} range: ${expectedRange.min}-${expectedRange.max}`
    );
    return false;
  }

  return true;
}

/**
 * Validates that VM IDs are unique across all layers
 */
export function validateVmIdUniqueness(
  vmId: number,
  vmName: string,
  context: ValidationContext,
  result: ValidationResult,
  layer: string
): boolean {
  if (context.vm_ids_used.has(vmId)) {
    const existingVm = context.vm_ids_used.get(vmId);
    addError(
      result,
      layer,
      `${vmName}.vm_id`,
      `VM ID ${vmId} is already used by "${existingVm}"`,
      "critical",
      `Each VM must have a unique ID. Change the VM ID to an unused value.`
    );
    return false;
  }

  context.vm_ids_used.set(vmId, vmName);
  return true;
}

/**
 * Validates an array of VM IDs for a service
 */
export function validateVmIdsForService(
  vmIds: number[],
  serviceName: string,
  expectedRole: VMRole | string,
  minCount: number,
  result: ValidationResult,
  layer: string,
  context: ValidationContext,
  infrastructureTier: InfrastructureTierType = "production"
): boolean {
  let isValid = true;

  // Check minimum count
  if (vmIds.length < minCount) {
    if (infrastructureTier === "local" && minCount > 1) {
      // For local, single VM is OK with warning
      addWarning(
        result,
        layer,
        `${serviceName}.vm_ids`,
        `${serviceName} has ${vmIds.length} VM(s) - not highly available (OK for local)`,
        `For production, use at least ${minCount} VMs for HA`
      );
    } else {
      addError(
        result,
        layer,
        `${serviceName}.vm_ids`,
        `${serviceName} requires at least ${minCount} VM(s), found ${vmIds.length}`,
        "error",
        `Add ${minCount - vmIds.length} more VM ID(s) to ${serviceName}.vm_ids`
      );
      isValid = false;
    }
  }

  // Check each VM ID
  for (const vmId of vmIds) {
    // Check range
    if (!validateVmIdRange(vmId, expectedRole as VMRole, serviceName, result, layer, infrastructureTier)) {
      isValid = false;
    }

    // Check uniqueness
    if (!validateVmIdUniqueness(vmId, `${serviceName}[${vmId}]`, context, result, layer)) {
      isValid = false;
    }
  }

  return isValid;
}

/**
 * Gets the suggested range for a VM role (string format)
 */
export function getSuggestedRangeForRole(role: VMRole | "firewall" | "bastion"): string {
  const range = getExpectedRangeForRole(role);
  if (range) {
    return `${range.min}-${range.max}`;
  }
  return `${TYPE_VM_ID_RANGES.APPLICATIONS.min}+`;
}
