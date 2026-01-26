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
# BACKUP SERVICE - ${datacenter.fullName.toUpperCase()} (${region.name.toUpperCase()})
# ==============================================================================
#
# VM and data backup with deduplication.
# Location: ${region.name}/${datacenter.fullName} (Hub)
#
# ==============================================================================

scope: zonal
region: ${region.name}
datacenter: ${datacenter.fullName}

# ------------------------------------------------------------------------------
# SERVICE DEFINITION
# ------------------------------------------------------------------------------

role: backup                      # What this service provides
implementation: pbs               # pbs (Proxmox Backup Server) | restic (coming soon)

# Version managed by Soverstack - only tested versions allowed
# Current: 3.2 | Supported: 3.2, 3.1, 3.0

# ------------------------------------------------------------------------------
# INSTANCES
# ------------------------------------------------------------------------------

instances:
  - name: pbs-${region.name}-01
    vm_id: 410
    flavor: large
    image: pbs-3.2
    host: ${nodePrefix}-01

# ------------------------------------------------------------------------------
# RETENTION POLICY
# ------------------------------------------------------------------------------

retention:
  keep_daily: 7
  keep_weekly: 4
  keep_monthly: 6

# ------------------------------------------------------------------------------
# CONFIGURATION OVERRIDES (optional)
# ------------------------------------------------------------------------------
# See: https://docs.soverstack.io/workloads/backup/pbs

overwrite_config:
  # scheduling:
  #   strategy: auto                # manual (default) | auto
  #   host: ${nodePrefix}-01
  #
  # networks:
  #   - vlan: backup
  #
  # pbs:
  #   datastore_path: /mnt/backups
  #   verify_new: true
  #   notify_email: admin@example.com
`;

  fs.writeFileSync(filePath, content.trim() + "\n");
}
