/**
 * Generate workloads/regional/{region}/siem.yaml - Wazuh
 */

import fs from "fs";
import path from "path";
import { GeneratorContext, RegionConfig } from "../../../types";

interface SiemYamlOptions {
  ctx: GeneratorContext;
  region: RegionConfig;
}

export function generateSiemYaml({ ctx, region }: SiemYamlOptions): void {
  const { projectPath, options } = ctx;
  const regionalDir = path.join(projectPath, "workloads", "regional", region.name);
  const filePath = path.join(regionalDir, "siem.yaml");

  fs.mkdirSync(regionalDir, { recursive: true });

  const primaryZone = region.zones[0];
  const nodePrefix = `pve-${region.name}-${primaryZone}`;
  const isLocal = options.infrastructureTier === "local";

  // Skip SIEM for local tier
  if (isLocal) {
    return;
  }

  const content = `# ==============================================================================
# SIEM SERVICE - ${region.name.toUpperCase()}
# ==============================================================================
#
# Security Information and Event Management.
# Location: ${region.name}/zone-${primaryZone}
#
# ==============================================================================

scope: regional
region: ${region.name}

# ------------------------------------------------------------------------------
# SERVICE DEFINITION
# ------------------------------------------------------------------------------

role: siem                        # What this service provides
implementation: wazuh             # wazuh | elastic-siem (coming soon)

# Version managed by Soverstack - only tested versions allowed
# Current: 4.8 | Supported: 4.8, 4.7

# ------------------------------------------------------------------------------
# INSTANCES
# ------------------------------------------------------------------------------

instances:
  - name: wazuh-${region.name}-01
    vm_id: 130
    flavor: large
    image: debian-12
    host: ${nodePrefix}-02

# ------------------------------------------------------------------------------
# CONFIGURATION OVERRIDES (optional)
# ------------------------------------------------------------------------------
# See: https://docs.soverstack.io/workloads/siem/wazuh

overwrite_config:
  # scheduling:
  #   strategy: auto                # manual (default) | auto
  #   host: ${nodePrefix}-01
  #
  # networks:
  #   - vlan: management
  #
  # wazuh:
  #   indexer_replicas: 1
  #   log_retention: 90d
  #   vulnerability_detection: true
`;

  fs.writeFileSync(filePath, content.trim() + "\n");
}
