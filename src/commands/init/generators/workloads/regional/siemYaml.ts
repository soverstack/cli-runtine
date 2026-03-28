/**
 * Generate workloads/regional/{region}/siem.yaml
 */

import fs from "fs";
import path from "path";
import { GeneratorContext, RegionConfig, versionLine, vmId } from "../../../types";

interface SiemYamlOptions {
  ctx: GeneratorContext;
  region: RegionConfig;
}

export function generateSiemYaml({ ctx, region }: SiemYamlOptions): void {
  const { projectPath, options } = ctx;
  const regionId = ctx.regionIds.get(region.name) || 1;
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
# SIEM - ${region.name.toUpperCase()}
# ==============================================================================
#
# Security Information and Event Management.
#
# ==============================================================================

services:
  # ============================================================================
  # SIEM
  # ============================================================================
  - role: siem
    scope: regional
    region: ${region.name}
    implementation: wazuh         # wazuh | elastic-siem | splunk
${versionLine("wazuh")}
    instances:
      - name: siem-${region.name}-01
        vm_id: ${vmId("regional", regionId, 0, "siem", 0)}
        flavor: large
        disk: 500
        image: debian-12
        host: ${nodePrefix}-02
    overwrite_config:
      # indexer_replicas: 1
      # log_retention: 90d
      # vulnerability_detection: true
`;

  fs.writeFileSync(filePath, content.trim() + "\n");
}
