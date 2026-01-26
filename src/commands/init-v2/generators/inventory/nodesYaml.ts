/**
 * Generate inventory/{region}/datacenters/{dc}/nodes.yaml
 */

import fs from "fs";
import path from "path";
import { GeneratorContext, DatacenterConfig, RegionConfig } from "../../types";

interface NodesYamlOptions {
  ctx: GeneratorContext;
  region: RegionConfig;
  datacenter: DatacenterConfig;
}

interface NodeInfo {
  name: string;
  ip: string;
  role: string;
  capabilities: string[];
  envPrefix: string;
}

export function generateNodesYaml({ ctx, region, datacenter }: NodesYamlOptions): void {
  const { projectPath, options } = ctx;
  const dcDir = path.join(
    projectPath,
    "inventory",
    region.name,
    "datacenters",
    datacenter.fullName
  );
  const filePath = path.join(dcDir, "nodes.yaml");

  // Ensure directory exists
  fs.mkdirSync(dcDir, { recursive: true });

  const isHub = datacenter.type === "hub";
  const isPrimaryZone =
    datacenter.type === "zone" &&
    region.name === options.primaryRegion &&
    datacenter.name === options.primaryZone;

  // Node count based on tier
  const nodeCount =
    options.infrastructureTier === "enterprise"
      ? 5
      : options.infrastructureTier === "production"
      ? 3
      : 1;

  // Hub always has 1 node minimum
  const hubNodeCount = options.infrastructureTier === "local" ? 1 : 2;
  const actualNodeCount = isHub ? hubNodeCount : nodeCount;

  // Generate IP base
  const baseOctet = isHub ? "20" : "10";
  const regionOctet = region.name === "eu" ? "1" : region.name === "us" ? "2" : "3";

  const nodes: NodeInfo[] = Array.from({ length: actualNodeCount }, (_, i) => {
    const num = String(i + 1).padStart(2, "0");
    // Hub: pve-hub-eu-01, Zone: pve-eu-paris-01
    const name = isHub
      ? `pve-hub-${region.name}-${num}`
      : `pve-${region.name}-${datacenter.name}-${num}`;
    const ip = `10.${regionOctet}.${baseOctet}.${10 + i}`;
    const role = i === 0 ? "primary" : "secondary";
    const capabilities = isHub
      ? ["storage", "hdd"]
      : isPrimaryZone
      ? ["compute", "nvme", "ceph"]
      : ["compute", "nvme"];

    // ENV prefix for bootstrap password: PVE_EU_PARIS_01 -> PVE_EU_PARIS_01_BOOTSTRAP_PASSWORD
    const envPrefix = name.toUpperCase().replace(/-/g, "_");

    return { name, ip, role, capabilities, envPrefix };
  });

  const content = `# ==============================================================================
# NODES: ${datacenter.fullName.toUpperCase()} (${region.name.toUpperCase()})
# ==============================================================================
#
# Bare metal servers in this datacenter.
# Type: ${datacenter.type.toUpperCase()}${isPrimaryZone ? " (Control Plane)" : ""}
#
# Bootstrap credentials are provided by your hosting provider (Hetzner/OVH).
# After bootstrap, Soverstack deploys its own SSH keys and disables password auth.
#
# ==============================================================================

datacenter_type: ${datacenter.type}

# ------------------------------------------------------------------------------
# NODES
# ------------------------------------------------------------------------------
#
# Capabilities:
#   - compute: Can run VMs
#   - storage: Has storage (PBS, MinIO)
#   - nvme: Has NVMe storage
#   - hdd: Has HDD storage (backup)
#   - ceph: Part of Ceph cluster
#   - gpu: Has GPU for AI/ML workloads

nodes:
${nodes
  .map(
    (n) => `  - name: ${n.name}
    address: ${n.ip}                    # REPLACE with actual IP from provider
    role: ${n.role}
    capabilities: [${n.capabilities.join(", ")}]

    # Bootstrap (initial connection to bare server)
    bootstrap:
      user: root
      port: 22
      password:
        type: env
        var_name: ${n.envPrefix}_BOOTSTRAP_PASSWORD`
  )
  .join("\n\n")}
${
  isPrimaryZone
    ? `
# ------------------------------------------------------------------------------
# CEPH STORAGE
# ------------------------------------------------------------------------------

ceph:
  enabled: true
  pool_name: ${datacenter.name}-pool
  replicas: ${Math.min(3, actualNodeCount)}
`
    : ""
}`;

  fs.writeFileSync(filePath, content.trim() + "\n");
}

/**
 * Get all node names for a datacenter (for .env generation)
 */
export function getNodeNames(
  region: RegionConfig,
  datacenter: DatacenterConfig,
  tier: string
): string[] {
  const isHub = datacenter.type === "hub";

  const nodeCount =
    tier === "enterprise" ? 5 : tier === "production" ? 3 : 1;
  const hubNodeCount = tier === "local" ? 1 : 2;
  const actualNodeCount = isHub ? hubNodeCount : nodeCount;

  return Array.from({ length: actualNodeCount }, (_, i) => {
    const num = String(i + 1).padStart(2, "0");
    return isHub
      ? `pve-hub-${region.name}-${num}`
      : `pve-${region.name}-${datacenter.name}-${num}`;
  });
}
