/**
 * Generate workloads/global/dns.yaml - PowerDNS + dnsdist
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
# DNS SERVICE
# ==============================================================================
#
# Authoritative DNS servers with load balancing.
# Location: ${options.primaryRegion}/zone-${options.primaryZone}
#
# ==============================================================================

scope: global

# ------------------------------------------------------------------------------
# SERVICE DEFINITION
# ------------------------------------------------------------------------------

role: dns                         # What this service provides
implementation: powerdns          # powerdns | coredns (coming soon) | bind (coming soon)

# Version managed by Soverstack - only tested versions allowed
# PowerDNS: 4.9 | dnsdist: 1.9

# ------------------------------------------------------------------------------
# INSTANCES
# ------------------------------------------------------------------------------

instances:
  # PowerDNS (Authoritative)
  - name: ns1
    vm_id: 50
    flavor: small
    image: debian-12
    host: ${primaryNodePrefix}-01
${!isLocal ? `
  - name: ns2
    vm_id: 51
    flavor: small
    image: debian-12
    host: ${primaryNodePrefix}-02

  # dnsdist (Load Balancer)
  - name: dnsdist-01
    vm_id: 60
    flavor: micro
    image: debian-12
    host: ${primaryNodePrefix}-01

  - name: dnsdist-02
    vm_id: 61
    flavor: micro
    image: debian-12
    host: ${primaryNodePrefix}-02` : ""}

# ------------------------------------------------------------------------------
# CONFIGURATION OVERRIDES (optional)
# ------------------------------------------------------------------------------
# See: https://docs.soverstack.io/workloads/dns/powerdns

overwrite_config:
  # scheduling:
  #   strategy: auto                # manual (default) | auto
  #   host: ${primaryNodePrefix}-01
  #
  # networks:
  #   - vlan: management
  #
  # powerdns:
  #   cache_ttl: 60
  #   allow_axfr_ips: []
  #
  # dnsdist:
  #   max_queued: 1000
`;

  fs.writeFileSync(filePath, content.trim() + "\n");
}
