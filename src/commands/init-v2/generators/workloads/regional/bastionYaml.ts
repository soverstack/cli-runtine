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
# BASTION SERVICE - ${region.name.toUpperCase()}
# ==============================================================================
#
# Zero-trust access to SSH, Kubernetes, and databases.
# Location: ${region.name}/zone-${primaryZone}
#
# ==============================================================================

scope: regional
region: ${region.name}

# ------------------------------------------------------------------------------
# SERVICE DEFINITION
# ------------------------------------------------------------------------------

role: bastion                     # What this service provides
implementation: teleport          # teleport | boundary (coming soon)

# Version managed by Soverstack - only tested versions allowed
# Current: 16 | Supported: 16, 15, 14

# ------------------------------------------------------------------------------
# INSTANCES
# ------------------------------------------------------------------------------

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

# ------------------------------------------------------------------------------
# CONFIGURATION OVERRIDES (optional)
# ------------------------------------------------------------------------------
# See: https://docs.soverstack.io/workloads/bastion/teleport

overwrite_config:
  # scheduling:
  #   strategy: auto                # manual (default) | auto
  #   host: ${nodePrefix}-01
  #
  # networks:
  #   - vlan: management
  #   - vlan: public
  #
  # teleport:
  #   cluster_name: ${region.name}-teleport
  #   session_recording: node
  #   audit_log_retention: 365d
`;

  fs.writeFileSync(filePath, content.trim() + "\n");
}
