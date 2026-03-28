/**
 * Generate inventory/{region}/datacenters/{dc}/network.yaml
 */

import fs from "fs";
import path from "path";
import { GeneratorContext, DatacenterConfig, RegionConfig } from "../../types";

interface NetworkYamlOptions {
  ctx: GeneratorContext;
  region: RegionConfig;
  datacenter: DatacenterConfig;
}

/**
 * Get region octet for subnet generation
 * eu=1, us=2, asia=3, etc.
 */
function getRegionOctet(regionName: string): number {
  const mapping: Record<string, number> = {
    eu: 1,
    us: 2,
    asia: 3,
    af: 4,
    sa: 5,
  };
  return mapping[regionName] || 1;
}

/**
 * Get datacenter octet offset
 * hub=50, zone index based
 */
function getDcOctet(datacenter: DatacenterConfig, zoneIndex: number): number {
  if (datacenter.type === "hub") {
    return 50; // Hub uses .50.x
  }
  return 10 + zoneIndex * 10; // Zones use .10.x, .20.x, etc. (but we use fixed per VLAN)
}

export function generateNetworkYaml({ ctx, region, datacenter }: NetworkYamlOptions): void {
  const { projectPath, options } = ctx;
  const dcDir = path.join(
    projectPath,
    "inventory",
    region.name,
    "datacenters",
    datacenter.fullName
  );
  const filePath = path.join(dcDir, "network.yaml");

  // Ensure directory exists
  fs.mkdirSync(dcDir, { recursive: true });

  const isHub = datacenter.type === "hub";
  const isControlPlane =
    datacenter.type === "zone" &&
    region.name === options.primaryRegion &&
    datacenter.name === options.primaryZone;

  const regionOctet = getRegionOctet(region.name);

  // Base octet for this datacenter (hub=50, zones start at 10)
  const baseOctet = isHub ? 50 : 10;

  // Generate VLANs section
  let vlansContent: string;

  if (isHub) {
    // Hub: only management, corosync, backup
    vlansContent = `vlans:
  - id: 10
    name: management
    subnet: 10.${regionOctet}.${baseOctet}.0/24
    gateway: 10.${regionOctet}.${baseOctet}.1
    mesh: true
    mtu: 1500

  - id: 11
    name: corosync
    subnet: 10.${regionOctet}.${baseOctet + 1}.0/24
    mesh: false
    mtu: 9000

  - id: 40
    name: backup
    subnet: 10.${regionOctet}.40.0/24
    gateway: 10.${regionOctet}.40.1
    mesh: true
    mtu: 1500`;
  } else {
    // Zone: all VLANs
    vlansContent = `vlans:
  - id: 10
    name: management
    subnet: 10.${regionOctet}.10.0/24
    gateway: 10.${regionOctet}.10.1
    mesh: true
    mtu: 1500

  - id: 11
    name: corosync
    subnet: 10.${regionOctet}.11.0/24
    mesh: false
    mtu: 9000

  - id: 20
    name: vm-network
    subnet: 10.${regionOctet}.20.0/24
    gateway: 10.${regionOctet}.20.1
    mesh: true
    mtu: 1500

  - id: 30
    name: ceph-public
    subnet: 10.${regionOctet}.30.0/24
    mesh: false
    mtu: 9000

  - id: 31
    name: ceph-cluster
    subnet: 10.${regionOctet}.31.0/24
    mesh: false
    mtu: 9000

  - id: 40
    name: backup
    subnet: 10.${regionOctet}.40.0/24
    gateway: 10.${regionOctet}.40.1
    mesh: true
    mtu: 1500`;
  }

  // Generate public_ips section (only for zones, optional for non-control-plane)
  let publicIpsContent = "";
  if (!isHub) {
    if (isControlPlane) {
      publicIpsContent = `
# ------------------------------------------------------------------------------
# PUBLIC IPS (required for control plane)
# ------------------------------------------------------------------------------
# Soverstack assigns IPs automatically to services (firewall, dns, ingress, vpn)

public_ips:
  type: allocated_block
  allocated_block:
    block: ""                           # REQUIRED - e.g., "203.0.113.0/29"
    gateway: ""                         # REQUIRED - e.g., "203.0.113.1"
    usable_range: ""                    # REQUIRED - e.g., "203.0.113.2-203.0.113.6"

  # type: bgp (coming soon)
  # bgp:
  #   asn: 210123
  #   upstream_asn: 64512
  #   ip_blocks:
  #     - 203.0.113.0/24`;
    } else {
      publicIpsContent = `
# ------------------------------------------------------------------------------
# PUBLIC IPS (optional for non-control-plane zones)
# ------------------------------------------------------------------------------
# Uncomment if this datacenter has public IPs assigned

# public_ips:
#   type: allocated_block
#   allocated_block:
#     block: ""
#     gateway: ""
#     usable_range: ""`;
    }
  }

  const content = `# ==============================================================================
# NETWORK
# ==============================================================================
#
# Network configuration (VLANs, public IPs).
#
# ==============================================================================

# ------------------------------------------------------------------------------
# VLANS
# ------------------------------------------------------------------------------
# mesh: true  -> Traffic via Headscale (encrypted, cross-DC)
# mesh: false -> Direct L2 (local performance, same switch)
#
# Gateway: Only for mesh: true VLANs (firewall VM deployed by Soverstack)
# MTU: 1500 for mesh, 9000 (jumbo) for Ceph/Corosync

${vlansContent}
${publicIpsContent}
`;

  fs.writeFileSync(filePath, content.trim() + "\n");
}
