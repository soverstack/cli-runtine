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
    // Hub: storage-focused (HDD, no Ceph)
    // Zone: compute-focused (NVMe, Ceph cluster)
    const capabilities = isHub
      ? ["hdd", "backup"]
      : ["compute", "nvme", "ceph"];

    // ENV prefix for bootstrap password: PVE_EU_PARIS_01 -> PVE_EU_PARIS_01_BOOTSTRAP_PASSWORD
    const envPrefix = name.toUpperCase().replace(/-/g, "_");

    return { name, ip, role, capabilities, envPrefix };
  });

  // Capabilities documentation based on type
  const capabilitiesDoc = isHub
    ? `# Capabilities (Hub):
#   - hdd: HDD storage for backups (cold storage)
#   - backup: Runs backup services (PBS, restic)
#   - gpu: (optional) GPU for transcoding`
    : `# Capabilities (Zone):
#   - compute: Runs production VMs
#   - nvme: NVMe storage (fast)
#   - ceph: Part of distributed Ceph cluster
#   - gpu: (optional) GPU for AI/ML workloads`;

  const content = `# ==============================================================================
# NODES
# ==============================================================================
#
# Bare metal servers (Proxmox hosts).
#
# Bootstrap credentials are provided by your bare-metal provider.
# After bootstrap, Soverstack deploys SSH keys and disables password auth.
#
# ==============================================================================

# ------------------------------------------------------------------------------
# NODES
# ------------------------------------------------------------------------------
#
${capabilitiesDoc}

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
  !isHub
    ? `
# ------------------------------------------------------------------------------
# CEPH STORAGE
# ------------------------------------------------------------------------------
# All zone nodes are part of the Ceph cluster.
# Validation enforces: min 3 nodes, odd number (quorum).

ceph:
  enabled: true
  pool_name: ${datacenter.name}-pool
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
