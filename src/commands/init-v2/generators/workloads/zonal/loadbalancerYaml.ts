/**
 * Generate workloads/zonal/{region}/{dc}/loadbalancer.yaml - HAProxy
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
# LOADBALANCER SERVICE - ${datacenter.fullName.toUpperCase()} (${region.name.toUpperCase()})
# ==============================================================================
#
# HTTP/TCP load balancing and reverse proxy.
# Location: ${region.name}/${datacenter.fullName}
#
# ==============================================================================

scope: zonal
region: ${region.name}
datacenter: ${datacenter.fullName}

# ------------------------------------------------------------------------------
# SERVICE DEFINITION
# ------------------------------------------------------------------------------

role: loadbalancer                # What this service provides
implementation: haproxy           # haproxy | nginx (coming soon) | traefik (coming soon)

# Version managed by Soverstack - only tested versions allowed
# Current: 3.0 | Supported: 3.0, 2.9, 2.8

# ------------------------------------------------------------------------------
# INSTANCES
# ------------------------------------------------------------------------------

instances:
  - name: haproxy-${region.name}-${datacenter.name}-01
    vm_id: ${vmIdBase}
    flavor: small
    image: debian-12
    host: ${nodePrefix}-01
${!isLocal ? `
  - name: haproxy-${region.name}-${datacenter.name}-02
    vm_id: ${vmIdBase + 1}
    flavor: small
    image: debian-12
    host: ${nodePrefix}-02` : ""}

# ------------------------------------------------------------------------------
# CONFIGURATION OVERRIDES (optional)
# ------------------------------------------------------------------------------
# See: https://docs.soverstack.io/workloads/loadbalancer/haproxy

overwrite_config:
  # scheduling:
  #   strategy: auto                # manual (default) | auto
  #   host: ${nodePrefix}-01
  #
  # networks:
  #   - vlan: management
  #   - vlan: public
  #
  # haproxy:
  #   maxconn: 50000
  #   stats_port: 8404
  #   ssl_default_bind_ciphers: "ECDHE+AESGCM"
`;

  fs.writeFileSync(filePath, content.trim() + "\n");
}
