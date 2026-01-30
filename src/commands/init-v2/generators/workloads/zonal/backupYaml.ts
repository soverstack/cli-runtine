/**
 * Generate workloads/zonal/{region}/{hub}/backup.yaml - Proxmox Backup Server
 */

import fs from "fs";
import path from "path";
import { GeneratorContext, RegionConfig, DatacenterConfig } from "../../../types";

interface BackupYamlOptions {
  ctx: GeneratorContext;
  region: RegionConfig;
  datacenter: DatacenterConfig;
}

export function generateBackupYaml({ ctx, region, datacenter }: BackupYamlOptions): void {
  const { projectPath, options } = ctx;
  const zonalDir = path.join(
    projectPath,
    "workloads",
    "zonal",
    region.name,
    datacenter.fullName
  );
  const filePath = path.join(zonalDir, "backup.yaml");

  fs.mkdirSync(zonalDir, { recursive: true });

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
    implementation: pbs           # pbs | restic | borg
    version: "3.2"              # 3.2, 3.1, 3.0
    instances:
      - name: pbs-${region.name}-01
        vm_id: 410
        flavor: large
        image: pbs-3.2
        host: ${nodePrefix}-01
    retention:
      keep_daily: 7
      keep_weekly: 4
      keep_monthly: 6
    overwrite_config:
      # datastore_path: /mnt/backups
      # verify_new: true
      # notify_email: admin@example.com
`;

  fs.writeFileSync(filePath, content.trim() + "\n");
}
