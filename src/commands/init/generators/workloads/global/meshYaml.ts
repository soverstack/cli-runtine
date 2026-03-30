/**
 * Generate workloads/global/mesh.yaml
 */

import fs from "fs";
import path from "path";
import { GeneratorContext, implLine, versionLine, vmId } from "../../../types";

export function generateMeshYaml(ctx: GeneratorContext): void {
  const { projectPath, options } = ctx;
  const globalDir = path.join(projectPath, "workloads", "global");
  const filePath = path.join(globalDir, "mesh.yaml");

  fs.mkdirSync(globalDir, { recursive: true });

  const primaryNodePrefix = `pve-${options.primaryRegion}-${options.primaryZone}`;
  const isLocal = options.infrastructureTier === "local";

  // Skip mesh for local tier (single node doesn't need VPN mesh)
  if (isLocal) {
    return;
  }

  const content = `# ==============================================================================
# MESH - GLOBAL
# ==============================================================================
#
# VPN mesh network connecting all regions and datacenters.
# Provides secure inter-datacenter communication.
#
# ==============================================================================

services:
  # ============================================================================
  # MESH CONTROLLER
  # ============================================================================
  - role: mesh
    scope: global
${implLine("mesh")}
${versionLine("headscale")}
    instances:
      - name: mesh-01
        vm_id: ${vmId("global", 0, 0, "mesh", 0)}
        flavor: small
        image: debian-12
        host: ${primaryNodePrefix}-01

      - name: mesh-02
        vm_id: ${vmId("global", 0, 0, "mesh", 1)}
        flavor: small
        image: debian-12
        host: ${primaryNodePrefix}-02
    overwrite_config:
      # server_url: https://vpn.${options.domain}
      # dns_base_domain: mesh.internal
      # oidc_issuer: https://identity.${options.domain}
`;

  fs.writeFileSync(filePath, content.trim() + "\n");
}
