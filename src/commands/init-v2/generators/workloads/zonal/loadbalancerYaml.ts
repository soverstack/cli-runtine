/**
 * Generate workloads/zonal/{region}/{dc}/loadbalancer.yaml
 */

import fs from "fs";
import path from "path";
import { GeneratorContext, RegionConfig, DatacenterConfig } from "../../../types";

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

  const nodePrefix = `pve-${region.name}-${datacenter.name}`;
  const isLocal = options.infrastructureTier === "local";

  // Zone index for VM ID offset
  const zoneIndex = region.zones.indexOf(datacenter.name);
  const vmIdBase = 15 + zoneIndex * 10;

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
    implementation: haproxy       # haproxy | nginx | traefik
    version: "3.0"              # 3.0, 2.9, 2.8
    instances:
      - name: lb-${region.name}-${datacenter.name}-01
        vm_id: ${vmIdBase}
        flavor: small
        image: debian-12
        host: ${nodePrefix}-01
${!isLocal ? `
      - name: lb-${region.name}-${datacenter.name}-02
        vm_id: ${vmIdBase + 1}
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
