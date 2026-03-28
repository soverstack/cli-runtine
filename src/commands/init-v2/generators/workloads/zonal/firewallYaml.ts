/**
 * Generate workloads/zonal/{region}/{dc}/firewall.yaml
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
# FIREWALL - ${datacenter.fullName.toUpperCase()} (${region.name.toUpperCase()})
# ==============================================================================
#
# Network firewall and routing.
#
# ==============================================================================

services:
  # ============================================================================
  # FIREWALL
  # ============================================================================
  - role: firewall
    scope: zonal
    region: ${region.name}
    datacenter: ${datacenter.fullName}
    implementation: vyos          # vyos | opnsense | pfsense
    version: "1.4"              # 1.4, 1.3
    instances:
      - name: fw-${region.name}-${datacenter.name}-01
        vm_id: ${vmIdBase}
        flavor: small
        image: vyos-1.4
        host: ${nodePrefix}-01
${!isLocal ? `
      - name: fw-${region.name}-${datacenter.name}-02
        vm_id: ${vmIdBase + 1}
        flavor: small
        image: vyos-1.4
        host: ${nodePrefix}-02` : ""}
    overwrite_config:
      # conntrack_table_size: 262144
      # vrrp_preempt: true
`;

  fs.writeFileSync(filePath, content.trim() + "\n");
}
