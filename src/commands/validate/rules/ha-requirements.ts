import { ValidationResult, addError, addWarning } from "../utils/types";
import { InfrastructureTierType } from "../../../types";

// ═══════════════════════════════════════════════════════════════════════════
// HIGH AVAILABILITY (HA) VALIDATION RULES
// ═══════════════════════════════════════════════════════════════════════════
//
// CRITICAL HA REQUIREMENTS (for production/enterprise tiers):
// - Minimum 3 nodes for quorum-based systems (Proxmox, Etcd, Ceph)
// - Odd number recommended for quorum voting
// - Nodes must be on different physical hosts for fault tolerance
// - Failover network required for production HA setups
//
// LOCAL TIER (dev/homelab):
// - Single node allowed
// - HA optional (warnings instead of errors)
// - Relaxed resource requirements
//
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Validates minimum node count for HA
 * For 'local' tier: allows single node (warning only)
 * For 'production'/'enterprise': enforces minimum count (error)
 */
export function validateMinimumNodes(
  nodes: any[],
  minCount: number,
  componentName: string,
  result: ValidationResult,
  layer: string,
  fieldName: string,
  infrastructureTier: InfrastructureTierType = "production"
): boolean {
  if (nodes.length < minCount) {
    // Local tier: warning only (HA is optional)
    if (infrastructureTier === "local") {
      addWarning(
        result,
        layer,
        fieldName,
        `${componentName} has ${nodes.length} node(s) - not highly available (OK for local/dev)`,
        nodes.length === 1
          ? "Single node is acceptable for local/development environments"
          : `Consider adding ${minCount - nodes.length} more node(s) for high availability if deploying to production`
      );
      return true; // Not a blocker for local tier
    }

    // Production/Enterprise tier: strict enforcement
    addError(
      result,
      layer,
      fieldName,
      `${componentName} requires at least ${minCount} nodes for HA, found ${nodes.length}`,
      "critical",
      `Add ${minCount - nodes.length} more node(s) to ensure high availability and quorum`
    );
    return false;
  }

  return true;
}

/**
 * Validates that nodes are distributed across different hosts
 * For 'local' tier: warning only (single host OK for dev)
 * For 'production'/'enterprise': error (distribution required)
 */
export function validateHostDistribution(
  nodes: { name: string; host?: string }[],
  componentName: string,
  result: ValidationResult,
  layer: string,
  fieldName: string,
  infrastructureTier: InfrastructureTierType = "production"
): boolean {
  const hostsUsed = new Map<string, string[]>();

  nodes.forEach((node) => {
    if (!node.host) return;

    if (!hostsUsed.has(node.host)) {
      hostsUsed.set(node.host, []);
    }
    hostsUsed.get(node.host)!.push(node.name);
  });

  let hasError = false;

  hostsUsed.forEach((nodesOnHost, host) => {
    if (nodesOnHost.length > 1) {
      // Local tier: warning only
      if (infrastructureTier === "local") {
        addWarning(
          result,
          layer,
          `${fieldName}.${nodesOnHost[0]}`,
          `${componentName} nodes [${nodesOnHost.join(", ")}] are on the same host "${host}" (OK for local/dev)`,
          "For production, distribute nodes across different physical hosts for fault tolerance"
        );
        return; // Not an error for local tier
      }

      // Production/Enterprise: error
      addError(
        result,
        layer,
        `${fieldName}.${nodesOnHost[0]}`,
        `${componentName} nodes [${nodesOnHost.join(", ")}] are on the same host "${host}" - NO fault tolerance`,
        "critical",
        `Distribute nodes across different physical hosts. If one host fails, all ${componentName} nodes on it will fail.`
      );
      hasError = true;
    }
  });

  return !hasError;
}

/**
 * Warns if node count is even (problematic for quorum)
 * Only applies to production/enterprise tiers with HA
 */
export function validateOddNodeCount(
  nodeCount: number,
  componentName: string,
  result: ValidationResult,
  layer: string,
  fieldName: string,
  infrastructureTier: InfrastructureTierType = "production"
): void {
  // Skip for local tier or when not enough nodes for HA
  if (infrastructureTier === "local" || nodeCount < 3) {
    return;
  }

  if (nodeCount > 0 && nodeCount % 2 === 0) {
    addWarning(
      result,
      layer,
      fieldName,
      `${componentName} has ${nodeCount} nodes (even number) - odd numbers are recommended for quorum-based systems`,
      `Consider adding 1 more node (total: ${nodeCount + 1}) for optimal quorum voting`
    );
  }
}

/**
 * Validates that a failover network is configured for HA setups
 * For 'local' tier: optional (warning only)
 * For 'production'/'enterprise': required (error)
 */
export function validateFailoverNetwork(
  failoverSubnet: string | undefined,
  hasHA: boolean,
  result: ValidationResult,
  layer: string,
  infrastructureTier: InfrastructureTierType = "production"
): boolean {
  if (hasHA && !failoverSubnet) {
    // Local tier: warning only
    if (infrastructureTier === "local") {
      addWarning(
        result,
        layer,
        "network.failover_subnet",
        "Failover subnet not configured (OK for local/dev)",
        "For production, configure a failover subnet for public IP failover and redundancy"
      );
      return true;
    }

    // Production/Enterprise: required
    addError(
      result,
      layer,
      "network.failover_subnet",
      "Failover subnet is REQUIRED for High Availability setups",
      "critical",
      "Configure a failover subnet (e.g., '203.0.113.0/29') for public IP failover and redundancy"
    );
    return false;
  }

  return true;
}

/**
 * Validates Ceph requirements
 * For 'local' tier: allows single server (warning)
 * For 'production'/'enterprise': minimum 3 servers required (error)
 */
export function validateCephRequirements(
  cephEnabled: boolean,
  servers: string[],
  result: ValidationResult,
  layer: string,
  infrastructureTier: InfrastructureTierType = "production"
): boolean {
  if (!cephEnabled) return true;

  if (servers.length < 3) {
    // Local tier: warning only
    if (infrastructureTier === "local") {
      addWarning(
        result,
        layer,
        "ceph.servers",
        `Ceph has ${servers.length} server(s) - not highly available (OK for local/dev)`,
        "For production, use at least 3 servers for Ceph data redundancy, or consider using local storage"
      );
      return true;
    }

    // Production/Enterprise: required
    addError(
      result,
      layer,
      "ceph.servers",
      `Ceph requires at least 3 servers for data redundancy, found ${servers.length}`,
      "critical",
      "Add more servers to Ceph cluster or disable Ceph (set enabled: false)"
    );
    return false;
  }

  return true;
}

/**
 * Validates resource constraints for VMs based on role
 * For 'local' tier: relaxed requirements (warnings instead of errors)
 * For 'production'/'enterprise': strict requirements (errors)
 */
export function validateResourceConstraints(
  vmName: string,
  role: string,
  cpu: number,
  ram: number, // in MB
  result: ValidationResult,
  layer: string,
  infrastructureTier: InfrastructureTierType = "production"
): boolean {
  let hasError = false;

  // Kubernetes Master minimum requirements
  if (role === "k8s_master") {
    // CPU validation
    const minCpu = infrastructureTier === "local" ? 1 : 2;
    if (cpu < minCpu) {
      if (infrastructureTier === "local") {
        addWarning(
          result,
          layer,
          `${vmName}.cpu`,
          `K8s Master has ${cpu} CPU core(s) - may be slow (OK for local/dev)`,
          "For production, use at least 2 cores (recommended: 4 cores)"
        );
      } else {
        addError(
          result,
          layer,
          `${vmName}.cpu`,
          `K8s Master requires at least 2 CPU cores, ${vmName} has ${cpu}`,
          "error",
          "Increase CPU to at least 2 cores (recommended: 4 cores)"
        );
        hasError = true;
      }
    }

    // RAM validation
    const minRam = infrastructureTier === "local" ? 2048 : 4096;
    if (ram < minRam) {
      if (infrastructureTier === "local") {
        addWarning(
          result,
          layer,
          `${vmName}.ram`,
          `K8s Master has ${ram}MB RAM - may be slow (OK for local/dev)`,
          "For production, use at least 4096MB (recommended: 8192MB)"
        );
      } else {
        addError(
          result,
          layer,
          `${vmName}.ram`,
          `K8s Master requires at least 4GB RAM, ${vmName} has ${ram}MB`,
          "error",
          "Increase RAM to at least 4096MB (recommended: 8192MB)"
        );
        hasError = true;
      }
    }
  }

  // Kubernetes Worker minimum requirements
  if (role === "k8s_worker") {
    // CPU validation
    const minCpu = infrastructureTier === "local" ? 1 : 2;
    if (cpu < minCpu) {
      if (infrastructureTier === "local") {
        addWarning(
          result,
          layer,
          `${vmName}.cpu`,
          `K8s Worker has ${cpu} CPU core(s) - may be slow (OK for local/dev)`,
          "For production, use at least 2 cores (recommended: 4 cores)"
        );
      } else {
        addWarning(
          result,
          layer,
          `${vmName}.cpu`,
          `K8s Worker has only ${cpu} CPU core(s) - may not handle production workloads`,
          "Consider using at least 4 CPU cores for production workers"
        );
      }
    }

    // RAM validation
    const minRam = infrastructureTier === "local" ? 1024 : 2048;
    if (ram < minRam) {
      if (infrastructureTier === "local") {
        addWarning(
          result,
          layer,
          `${vmName}.ram`,
          `K8s Worker has ${ram}MB RAM - may be slow (OK for local/dev)`,
          "For production, use at least 2048MB (recommended: 8192MB+)"
        );
      } else {
        addError(
          result,
          layer,
          `${vmName}.ram`,
          `K8s Worker requires at least 2GB RAM, ${vmName} has ${ram}MB`,
          "error",
          "Increase RAM to at least 2048MB (recommended: 8192MB+)"
        );
        hasError = true;
      }
    }
  }

  return !hasError;
}
