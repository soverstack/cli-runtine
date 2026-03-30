/**
 * Generate workloads/zonal/{region}/{hub}/backup.yaml
 */

import fs from "fs";
import path from "path";
import { GeneratorContext, RegionConfig, DatacenterConfig, implLine, versionLine, vmId } from "../../../types";

interface BackupYamlOptions {
  ctx: GeneratorContext;
  region: RegionConfig;
  datacenter: DatacenterConfig;
}

export function generateBackupYaml({ ctx, region, datacenter }: BackupYamlOptions): void {
  const { projectPath, options } = ctx;
  const zonalDir = path.join(projectPath, "workloads", "zonal", region.name, datacenter.fullName);
  const filePath = path.join(zonalDir, "backup.yaml");

  fs.mkdirSync(zonalDir, { recursive: true });

  const regionId = ctx.regionIds.get(region.name) || 1;
  const dcId = ctx.dcIds.get(region.name)?.get(datacenter.fullName) || 1;

  const nodePrefix = `pve-hub-${region.name}`;

  const content = `# ==============================================================================
# BACKUP - ${datacenter.fullName.toUpperCase()} (${region.name.toUpperCase()})
# ==============================================================================
#
# VM and data backup with deduplication.
#
# ==============================================================================

services:
  # ============================================================================
  # BACKUP
  # ============================================================================
  - role: backup
    scope: zonal
    region: ${region.name}
    datacenter: ${datacenter.fullName}
${implLine("backup")}
${versionLine("pbs")}
    instances:
      - name: backup-${region.name}-01
        vm_id: ${vmId("zonal", regionId, dcId, "backup", 0)}
        flavor: small
        disk: 500
        image: debian-12
        host: ${nodePrefix}-01
    overwrite_config:
      # retention:
      #   keep_daily: 7
      #   keep_weekly: 4
      #   keep_monthly: 6
      # datastore_path: /mnt/backups
      # verify_new: true
      # notify_email: admin@example.com
`;

  fs.writeFileSync(filePath, content.trim() + "\n");
}
