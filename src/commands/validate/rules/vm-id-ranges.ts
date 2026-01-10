import { ValidationResult, addError, ValidationContext } from "../utils/types";
import { VMRole } from "../../../types";

// ═══════════════════════════════════════════════════════════════════════════
// VM ID RANGE VALIDATION RULES
// ═══════════════════════════════════════════════════════════════════════════
//
// RESERVED ID RANGES:
// - 100-199: Firewalls (VyOS/OPNsense/pfSense)
// - 200-299: Bastions (Headscale/Wireguard/Netbird)
// - 300-399: Load Balancers (HAProxy for K8s API)
// - 400-499: Kubernetes Masters
// - 500-599: Kubernetes Workers
// - 600-699: CI/CD Runners
// - 700+: General Purpose VMs
//
// ═══════════════════════════════════════════════════════════════════════════

interface VMIdRange {
  min: number;
  max: number;
  role: VMRole | "firewall" | "bastion" | "load_balancer";
  description: string;
}

export const VM_ID_RANGES: VMIdRange[] = [
  { min: 100, max: 199, role: "firewall", description: "Firewalls" },
  { min: 200, max: 299, role: "bastion", description: "Bastions" },
  { min: 300, max: 399, role: "general_purpose", description: "Load Balancers" },
  { min: 400, max: 499, role: "k8s_master", description: "Kubernetes Masters" },
  { min: 500, max: 599, role: "k8s_worker", description: "Kubernetes Workers" },
  { min: 600, max: 699, role: "ci_runner", description: "CI/CD Runners" },
  { min: 700, max: 999999, role: "general_purpose", description: "General Purpose VMs" },
];

/**
 * Validates that a VM ID is in the correct range for its role
 */
export function validateVmIdRange(
  vmId: number,
  role: VMRole | "firewall" | "bastion",
  vmName: string,
  result: ValidationResult,
  layer: string
): boolean {
  // Special handling for firewall and bastion
  if (role === "firewall") {
    if (vmId < 100 || vmId > 199) {
      addError(
        result,
        layer,
        `${vmName}.vm_id`,
        `Firewall VM ID ${vmId} must be in range 100-199`,
        "error",
        `Use a VM ID between 100-199 for firewall VMs`
      );
      return false;
    }
    return true;
  }

  if (role === "bastion") {
    if (vmId < 200 || vmId > 299) {
      addError(
        result,
        layer,
        `${vmName}.vm_id`,
        `Bastion VM ID ${vmId} must be in range 200-299`,
        "error",
        `Use a VM ID between 200-299 for bastion VMs`
      );
      return false;
    }
    return true;
  }

  // For regular VMs, check if they're in reserved ranges
  if (vmId >= 100 && vmId < 400) {
    const range = VM_ID_RANGES.find((r) => vmId >= r.min && vmId <= r.max);
    if (range && range.role !== role) {
      addError(
        result,
        layer,
        `${vmName}.vm_id`,
        `VM ID ${vmId} is in reserved range for ${range.description} (${range.min}-${range.max}) but role is ${role}`,
        "error",
        `Use VM IDs >= 400 for regular VMs or change role to match the reserved range`
      );
      return false;
    }
  }

  // Validate that role matches suggested range
  const suggestedRange = VM_ID_RANGES.find((r) => r.role === role);
  if (suggestedRange && (vmId < suggestedRange.min || vmId > suggestedRange.max)) {
    addError(
      result,
      layer,
      `${vmName}.vm_id`,
      `VM ID ${vmId} for role ${role} should be in range ${suggestedRange.min}-${suggestedRange.max}`,
      "error",
      `Use a VM ID in the ${suggestedRange.description} range: ${suggestedRange.min}-${suggestedRange.max}`
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
      `VM ID ${vmId} is already used by ${existingVm}`,
      "critical",
      `Each VM must have a unique ID. Change the VM ID to an unused value.`
    );
    return false;
  }

  context.vm_ids_used.set(vmId, vmName);
  return true;
}

/**
 * Gets the suggested range for a VM role
 */
export function getSuggestedRangeForRole(role: VMRole | "firewall" | "bastion"): string {
  const range = VM_ID_RANGES.find((r) => r.role === role);
  if (range) {
    return `${range.min}-${range.max}`;
  }
  return "700+";
}
