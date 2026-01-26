/**
 * Generate workloads/regional/{region}/bastion.yaml - Teleport
 */

import fs from "fs";
import path from "path";
import { GeneratorContext, RegionConfig } from "../../../types";

interface BastionYamlOptions {
  ctx: GeneratorContext;
  region: RegionConfig;
}

export function generateBastionYaml({ ctx, region }: BastionYamlOptions): void {
  const { projectPath, options } = ctx;
  const regionalDir = path.join(projectPath, "workloads", "regional", region.name);
  const filePath = path.join(regionalDir, "bastion.yaml");

  fs.mkdirSync(regionalDir, { recursive: true });

  const primaryZone = region.zones[0];
  const nodePrefix = `pve-${region.name}-${primaryZone}`;
  const isLocal = options.infrastructureTier === "local";

  const content = `# ==============================================================================
# BASTION - ${region.name.toUpperCase()}
# ==============================================================================
#
# Zero-trust access to SSH, Kubernetes, and databases.
#
# ==============================================================================

services:
  # ============================================================================
  # BASTION
  # ============================================================================
  - role: bastion
    scope: regional
    region: ${region.name}
    implementation: teleport      # teleport | boundary | guacamole
    # Version: 16 | Supported: 16, 15, 14
    instances:
      - name: teleport-${region.name}-01
        vm_id: 120
        flavor: standard
        image: debian-12
        host: ${nodePrefix}-01
${!isLocal ? `
      - name: teleport-${region.name}-02
        vm_id: 121
        flavor: standard
        image: debian-12
        host: ${nodePrefix}-02` : ""}
    overwrite_config:
      # cluster_name: ${region.name}-teleport
      # session_recording: node
      # audit_log_retention: 365d

# ------------------------------------------------------------------------------
# GLOBAL OVERRIDES (optional)
# ------------------------------------------------------------------------------
# See: https://docs.soverstack.io/workloads/bastion

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
