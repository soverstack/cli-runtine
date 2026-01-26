/**
 * Generate workloads/zonal/{region}/{dc}/firewall.yaml - VyOS
 */

import fs from "fs";
import path from "path";
import { GeneratorContext, RegionConfig, DatacenterConfig } from "../../../types";

interface FirewallYamlOptions {
  ctx: GeneratorContext;
  region: RegionConfig;
  datacenter: DatacenterConfig;
}

export function generateFirewallYaml({ ctx, region, datacenter }: FirewallYamlOptions): void {
  const { projectPath, options } = ctx;
  const zonalDir = path.join(
    projectPath,
    "workloads",
    "zonal",
    region.name,
    datacenter.fullName
  );
  const filePath = path.join(zonalDir, "firewall.yaml");

  fs.mkdirSync(zonalDir, { recursive: true });

  const nodePrefix = `pve-${region.name}-${datacenter.name}`;
  const isLocal = options.infrastructureTier === "local";

  // Zone index for VM ID offset
  const zoneIndex = region.zones.indexOf(datacenter.name);
  const vmIdBase = 10 + zoneIndex * 10;

  const content = `# ==============================================================================
# FIREWALL SERVICE - ${datacenter.fullName.toUpperCase()} (${region.name.toUpperCase()})
# ==============================================================================
#
# Network firewall and routing.
# Location: ${region.name}/${datacenter.fullName}
#
# ==============================================================================

scope: zonal
region: ${region.name}
datacenter: ${datacenter.fullName}

# ------------------------------------------------------------------------------
# SERVICE DEFINITION
# ------------------------------------------------------------------------------

role: firewall                    # What this service provides
implementation: vyos              # vyos | opnsense (coming soon) | pfsense (coming soon)

# Version managed by Soverstack - only tested versions allowed
# Current: 1.4 | Supported: 1.4, 1.3

# ------------------------------------------------------------------------------
# INSTANCES
# ------------------------------------------------------------------------------

instances:
  - name: vyos-${region.name}-${datacenter.name}-01
    vm_id: ${vmIdBase}
    flavor: small
    image: vyos-1.4
    host: ${nodePrefix}-01
${!isLocal ? `
  - name: vyos-${region.name}-${datacenter.name}-02
    vm_id: ${vmIdBase + 1}
    flavor: small
    image: vyos-1.4
    host: ${nodePrefix}-02` : ""}

# ------------------------------------------------------------------------------
# CONFIGURATION OVERRIDES (optional)
# ------------------------------------------------------------------------------
# See: https://docs.soverstack.io/workloads/firewall/vyos

overwrite_config:
  # scheduling:
  #   strategy: auto                # manual (default) | auto
  #   host: ${nodePrefix}-01
  #
  # networks:
  #   - vlan: management
  #   - vlan: public
  #
  # vyos:
  #   conntrack_table_size: 262144
  #   vrrp_preempt: true
`;

  fs.writeFileSync(filePath, content.trim() + "\n");
}
