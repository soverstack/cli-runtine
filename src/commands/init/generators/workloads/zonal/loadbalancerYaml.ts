/**
 * Generate workloads/zonal/{region}/{dc}/loadbalancer.yaml
 */

import fs from "fs";
import path from "path";
import { GeneratorContext, RegionConfig, DatacenterConfig, implLine, versionLine, vmId } from "../../../types";

interface LoadbalancerYamlOptions {
  ctx: GeneratorContext;
  region: RegionConfig;
  datacenter: DatacenterConfig;
}

export function generateLoadbalancerYaml({ ctx, region, datacenter }: LoadbalancerYamlOptions): void {
  const { projectPath, options } = ctx;
  const zonalDir = path.join(
    projectPath,
    "workloads",
    "zonal",
    region.name,
    datacenter.fullName
  );
  const filePath = path.join(zonalDir, "loadbalancer.yaml");

  fs.mkdirSync(zonalDir, { recursive: true });

  const regionId = ctx.regionIds.get(region.name) || 1;
  const dcId = ctx.dcIds.get(region.name)?.get(datacenter.fullName) || 1;

  const nodePrefix = `pve-${region.name}-${datacenter.name}`;
  const isLocal = options.infrastructureTier === "local";

  const content = `# ==============================================================================
# LOADBALANCER - ${datacenter.fullName.toUpperCase()} (${region.name.toUpperCase()})
# ==============================================================================
#
# HTTP/TCP load balancing and reverse proxy.
#
# ==============================================================================

services:
  # ============================================================================
  # LOADBALANCER
  # ============================================================================
  - role: loadbalancer
    scope: zonal
    region: ${region.name}
    datacenter: ${datacenter.fullName}
${implLine("loadbalancer")}
${versionLine("haproxy")}
    instances:
      - name: lb-${region.name}-${datacenter.name}-01
        vm_id: ${vmId("zonal", regionId, dcId, "loadbalancer", 0)}
        flavor: small
        image: debian-12
        host: ${nodePrefix}-01
${!isLocal ? `
      - name: lb-${region.name}-${datacenter.name}-02
        vm_id: ${vmId("zonal", regionId, dcId, "loadbalancer", 1)}
        flavor: small
        image: debian-12
        host: ${nodePrefix}-02` : ""}
    overwrite_config:
      # maxconn: 50000
      # stats_port: 8404
      # ssl_default_bind_ciphers: "ECDHE+AESGCM"
`;

  fs.writeFileSync(filePath, content.trim() + "\n");
}
