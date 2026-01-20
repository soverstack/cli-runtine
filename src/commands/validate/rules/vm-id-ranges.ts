import { ValidationResult, addError, addWarning, ValidationContext } from "../utils/types";
import { VMRole, InfrastructureTierType } from "../../../types";
import { VM_ID_RANGES as TYPE_VM_ID_RANGES } from "../../../constants";

// ═══════════════════════════════════════════════════════════════════════════
// VM ID RANGE VALIDATION RULES
// ═══════════════════════════════════════════════════════════════════════════
//
// RESERVED ID RANGES (from types.ts):
// - 1-99: Firewalls (VyOS/OPNsense)
// - 100-199: Bastion & Management (Headscale)
// - 200-249: IAM/SSO (Keycloak, Authentik)
// - 250-299: Databases (PostgreSQL, Redis)
// - 300-349: Monitoring (Prometheus, Grafana)
// - 350-399: Logging/Audit (Loki, Wazuh, Falco)
// - 400-449: Load Balancers (HAProxy)
// - 450-499: CI/CD, Backup & Misc
// - 500-599: K8s Control Plane (Masters)
// - 600-3000: K8s Data Plane (Workers)
// - 3001+: Applications
//
// ═══════════════════════════════════════════════════════════════════════════

interface VMIdRange {
  min: number;
  max: number;
  role: VMRole | "firewall" | "bastion" | "load_balancer" | "iam_sso" | "database";
  description: string;
}

// Convert the TYPE_VM_ID_RANGES to the format used by validation
export const VM_ID_RANGES: VMIdRange[] = [
  { min: TYPE_VM_ID_RANGES.FIREWALL.min, max: TYPE_VM_ID_RANGES.FIREWALL.max, role: "firewall", description: "Firewalls" },
  { min: TYPE_VM_ID_RANGES.DNS_LB.min, max: TYPE_VM_ID_RANGES.DNS_LB.max, role: "dns_lb", description: "DNS Load Balancers" },
  { min: TYPE_VM_ID_RANGES.DNS_SERVER.min, max: TYPE_VM_ID_RANGES.DNS_SERVER.max, role: "dns_server", description: "DNS Servers" },
  { min: TYPE_VM_ID_RANGES.BASTION.min, max: TYPE_VM_ID_RANGES.BASTION.max, role: "bastion", description: "Bastions" },
  { min: TYPE_VM_ID_RANGES.SECRETS.min, max: TYPE_VM_ID_RANGES.SECRETS.max, role: "secrets", description: "Secrets Management" },
  { min: TYPE_VM_ID_RANGES.IAM_SSO.min, max: TYPE_VM_ID_RANGES.IAM_SSO.max, role: "iam_sso", description: "IAM/SSO" },
  { min: TYPE_VM_ID_RANGES.DATABASE.min, max: TYPE_VM_ID_RANGES.DATABASE.max, role: "database", description: "Databases" },
  { min: TYPE_VM_ID_RANGES.CACHE.min, max: TYPE_VM_ID_RANGES.CACHE.max, role: "cache", description: "Cache Servers" },
  { min: TYPE_VM_ID_RANGES.MONITORING.min, max: TYPE_VM_ID_RANGES.MONITORING.max, role: "monitoring", description: "Monitoring" },
  { min: TYPE_VM_ID_RANGES.ALERTING.min, max: TYPE_VM_ID_RANGES.ALERTING.max, role: "alerting", description: "Alerting" },
  { min: TYPE_VM_ID_RANGES.DASHBOARDS.min, max: TYPE_VM_ID_RANGES.DASHBOARDS.max, role: "dashboards", description: "Dashboards" },
  { min: TYPE_VM_ID_RANGES.LOGGING.min, max: TYPE_VM_ID_RANGES.LOGGING.max, role: "logging", description: "Logging" },
  { min: TYPE_VM_ID_RANGES.SIEM.min, max: TYPE_VM_ID_RANGES.SIEM.max, role: "siem", description: "SIEM/Security" },
  { min: TYPE_VM_ID_RANGES.LOAD_BALANCER.min, max: TYPE_VM_ID_RANGES.LOAD_BALANCER.max, role: "load_balancer", description: "Load Balancers" },
  { min: TYPE_VM_ID_RANGES.TOOLS.min, max: TYPE_VM_ID_RANGES.TOOLS.max, role: "pentest", description: "Tools" },
  { min: TYPE_VM_ID_RANGES.CI_CD.min, max: TYPE_VM_ID_RANGES.CI_CD.max, role: "ci_runner", description: "CI/CD" },
  { min: TYPE_VM_ID_RANGES.K8S_MASTER.min, max: TYPE_VM_ID_RANGES.K8S_MASTER.max, role: "k8s_master", description: "K8s Masters" },
  { min: TYPE_VM_ID_RANGES.K8S_WORKER.min, max: TYPE_VM_ID_RANGES.K8S_WORKER.max, role: "k8s_worker", description: "K8s Workers" },
  { min: TYPE_VM_ID_RANGES.APPLICATIONS.min, max: TYPE_VM_ID_RANGES.APPLICATIONS.max, role: "general_purpose", description: "Applications" },
];

/**
 * Gets the expected range for a role
 */
export function getExpectedRangeForRole(role: VMRole | string): { min: number; max: number } | null {
  switch (role) {
    case "firewall":
      return TYPE_VM_ID_RANGES.FIREWALL;
    case "dns_lb":
      return TYPE_VM_ID_RANGES.DNS_LB;
    case "dns_server":
      return TYPE_VM_ID_RANGES.DNS_SERVER;
    case "bastion":
      return TYPE_VM_ID_RANGES.BASTION;
    case "secrets":
      return TYPE_VM_ID_RANGES.SECRETS;
    case "iam_sso":
      return TYPE_VM_ID_RANGES.IAM_SSO;
    case "database":
      return TYPE_VM_ID_RANGES.DATABASE;
    case "cache":
      return TYPE_VM_ID_RANGES.CACHE;
    case "monitoring":
      return TYPE_VM_ID_RANGES.MONITORING;
    case "alerting":
      return TYPE_VM_ID_RANGES.ALERTING;
    case "dashboards":
      return TYPE_VM_ID_RANGES.DASHBOARDS;
    case "logging":
      return TYPE_VM_ID_RANGES.LOGGING;
    case "siem":
      return TYPE_VM_ID_RANGES.SIEM;
    case "load_balancer":
      return TYPE_VM_ID_RANGES.LOAD_BALANCER;
    case "pentest":
    case "management":
      return TYPE_VM_ID_RANGES.TOOLS;
    case "ci_runner":
      return TYPE_VM_ID_RANGES.CI_CD;
    case "k8s_master":
      return TYPE_VM_ID_RANGES.K8S_MASTER;
    case "k8s_worker":
      return TYPE_VM_ID_RANGES.K8S_WORKER;
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
