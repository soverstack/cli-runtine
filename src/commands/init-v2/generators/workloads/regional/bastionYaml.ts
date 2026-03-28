/**
 * Generate workloads/regional/{region}/bastion.yaml
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
    version: "16"               # 16, 15, 14
    instances:
      - name: bastion-${region.name}-01
        vm_id: 120
        flavor: small
        image: debian-12
        host: ${nodePrefix}-01
${!isLocal ? `
      - name: bastion-${region.name}-02
        vm_id: 121
        flavor: small
        image: debian-12
        host: ${nodePrefix}-02` : ""}
    overwrite_config:
      # cluster_name: ${region.name}-teleport
      # session_recording: node
      # audit_log_retention: 365d
`;

  fs.writeFileSync(filePath, content.trim() + "\n");
}
