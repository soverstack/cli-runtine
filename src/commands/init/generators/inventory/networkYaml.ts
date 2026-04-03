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

export function generateNetworkYaml({ ctx, region, datacenter }: NetworkYamlOptions): void {
  const { projectPath, options } = ctx;
  const dcDir = path.join(
    projectPath,
    "inventory",
    region.name,
    "datacenters",
    datacenter.fullName,
  );
  const filePath = path.join(dcDir, "network.yaml");

  fs.mkdirSync(dcDir, { recursive: true });

  const isHub = datacenter.type === "hub";
  const isControlPlane =
    datacenter.type === "zone" &&
    region.name === options.primaryRegion &&
    datacenter.name === options.primaryZone;

  const regionOctet = getRegionOctet(region.name);
  const baseOctet = isHub ? 50 : 10;

  let networksContent: string;

  if (isHub) {
    networksContent = `networks:
  management:
    subnet: 10.${regionOctet}.${baseOctet}.0/24
    gateway: 10.${regionOctet}.${baseOctet}.1

  backup:
    subnet: 10.${regionOctet}.40.0/24`;
  } else {
    networksContent = `networks:
  management:
    subnet: 10.${regionOctet}.${baseOctet}.0/24
    gateway: 10.${regionOctet}.${baseOctet}.1

  corosync:
    subnet: 10.${regionOctet}.${baseOctet + 1}.0/24

  ceph:
    subnet: 10.${regionOctet}.${baseOctet + 2}.0/24

  vm:
    subnet: 10.${regionOctet}.${baseOctet + 10}.0/24`;
  }

  let publicIpsContent = "";
  if (!isHub) {
    if (isControlPlane) {
      publicIpsContent = `
# ------------------------------------------------------------------------------
# PUBLIC IPS (required for control plane)
# ------------------------------------------------------------------------------
# Soverstack assigns IPs automatically to services (firewall, dns, ingress, vpn)
# See: https://soverstack.io/docs/concepts/public-ips

public_ips:
  type: block
  block: ""                             # REQUIRED - e.g., "203.0.113.0/28"
  gateway: ""                           # REQUIRED - e.g., "203.0.113.1"
  usable: ""                            # REQUIRED - e.g., "203.0.113.2-203.0.113.14"

  # Alternative: individual IPs (limited failover, not recommended for production)
  # type: individual
  # addresses:
  #   - ip: 203.0.113.20
  #     attached_to: pve-eu-paris-01

  # Alternative: BGP (own AS, full control)
  # type: bgp
  # asn: 64512
  # block: 203.0.113.0/24
  # upstream_peer: 198.51.100.1`;
    } else {
      publicIpsContent = `
# ------------------------------------------------------------------------------
# PUBLIC IPS (optional for non-control-plane zones)
# ------------------------------------------------------------------------------
# Uncomment if this datacenter needs public IPs

# public_ips:
#   type: block
#   block: ""
#   gateway: ""
#   usable: ""`;
    }
  }

  const content = `# ==============================================================================
# NETWORK
# ==============================================================================
#
# Logical networks for this datacenter.
# By default, all networks use the WireGuard mesh (no VLAN config needed).
# Add 'vlan:' to a network for physical VLAN backing (optional, for performance).
#
# See: https://soverstack.io/docs/concepts/networking
#
# ==============================================================================

${networksContent}

# Optional: add physical VLAN backing for performance-critical networks
# Example (Ceph on VLAN with jumbo frames):
#   ceph:
#     subnet: 10.1.12.0/24
#     vlan:
#       id: 12
#       interface: eth1
#       mtu: 9000
${publicIpsContent}
`;

  fs.writeFileSync(filePath, content.trim() + "\n");
}
