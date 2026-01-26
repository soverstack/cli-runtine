/**
 * Generate workloads/global/dns.yaml - Authoritative DNS + Load Balancer
 */

import fs from "fs";
import path from "path";
import { GeneratorContext } from "../../../types";

export function generateDnsYaml(ctx: GeneratorContext): void {
  const { projectPath, options } = ctx;
  const globalDir = path.join(projectPath, "workloads", "global");
  const filePath = path.join(globalDir, "dns.yaml");

  fs.mkdirSync(globalDir, { recursive: true });

  const primaryNodePrefix = `pve-${options.primaryRegion}-${options.primaryZone}`;
  const isLocal = options.infrastructureTier === "local";

  const content = `# ==============================================================================
# DNS - GLOBAL
# ==============================================================================
#
# Authoritative DNS servers with load balancing.
#
# ==============================================================================

services:
  # ============================================================================
  # DNS AUTHORITATIVE
  # ============================================================================
  - role: dns-authoritative
    scope: global
    implementation: powerdns      # powerdns | bind | knot
    # Version: 4.9 | Supported: 4.9, 4.8, 4.7
    instances:
      - name: pdns-01
        vm_id: 50
        flavor: small
        image: debian-12
        host: ${primaryNodePrefix}-01
${!isLocal ? `
      - name: pdns-02
        vm_id: 51
        flavor: small
        image: debian-12
        host: ${primaryNodePrefix}-02` : ""}
    zones:
      - name: ${options.domain}
        type: master
      - name: internal.${options.domain}
        type: master
    overwrite_config:
      # api_enabled: true
      # webserver_port: 8081
      # default_ttl: 3600
${!isLocal ? `
  # ============================================================================
  # DNS LOADBALANCER
  # ============================================================================
  - role: dns-loadbalancer
    scope: global
    implementation: dnsdist       # dnsdist | haproxy
    # Version: 1.9 | Supported: 1.9, 1.8, 1.7
    instances:
      - name: dnsdist-01
        vm_id: 60
        flavor: micro
        image: debian-12
        host: ${primaryNodePrefix}-01

      - name: dnsdist-02
        vm_id: 61
        flavor: micro
        image: debian-12
        host: ${primaryNodePrefix}-02
    overwrite_config:
      # cache_size: 10000
      # max_tcp_clients: 1000
      # webserver_port: 8083
` : ""}
# ------------------------------------------------------------------------------
# GLOBAL OVERRIDES (optional)
# ------------------------------------------------------------------------------
# See: https://docs.soverstack.io/workloads/dns

overwrite_config:
  # scheduling:
  #   strategy: auto                # manual (default) | auto
  #
  # networks:
  #   - vlan: management
  #   - vlan: public
`;

  fs.writeFileSync(filePath, content.trim() + "\n");
}
