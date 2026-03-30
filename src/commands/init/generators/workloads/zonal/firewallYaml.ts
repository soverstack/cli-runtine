/**
 * Generate workloads/zonal/{region}/{dc}/firewall.yaml
 */

import fs from "fs";
import path from "path";
import { GeneratorContext, RegionConfig, DatacenterConfig, implLine, versionLine, vmId } from "../../../types";

interface FirewallYamlOptions {
  ctx: GeneratorContext;
  region: RegionConfig;
  datacenter: DatacenterConfig;
}

export function generateFirewallYaml({ ctx, region, datacenter }: FirewallYamlOptions): void {
  const { projectPath, options } = ctx;
  const zonalDir = path.join(projectPath, "workloads", "zonal", region.name, datacenter.fullName);
  const filePath = path.join(zonalDir, "firewall.yaml");

  fs.mkdirSync(zonalDir, { recursive: true });

  const regionId = ctx.regionIds.get(region.name) || 1;
  const dcId = ctx.dcIds.get(region.name)?.get(datacenter.fullName) || 1;

  const nodePrefix = `pve-${region.name}-${datacenter.name}`;
  const isLocal = options.infrastructureTier === "local";

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
${implLine("firewall")}
${versionLine("vyos")}
    instances:
      - name: fw-${region.name}-${datacenter.name}-01
        vm_id: ${vmId("zonal", regionId, dcId, "firewall", 0)}
        flavor: small
        image: debian-12
        host: ${nodePrefix}-01
${
  !isLocal
    ? `
      - name: fw-${region.name}-${datacenter.name}-02
        vm_id: ${vmId("zonal", regionId, dcId, "firewall", 1)}
        flavor: small
        image: debian-12
        host: ${nodePrefix}-02`
    : ""
}
    overwrite_config:
      # conntrack_table_size: 262144
      # vrrp_preempt: true
`;

  fs.writeFileSync(filePath, content.trim() + "\n");
}
