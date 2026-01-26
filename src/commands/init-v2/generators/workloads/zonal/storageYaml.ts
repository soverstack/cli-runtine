/**
 * Generate workloads/zonal/{region}/{hub}/storage.yaml - MinIO
 */

import fs from "fs";
import path from "path";
import { GeneratorContext, RegionConfig, DatacenterConfig } from "../../../types";

interface StorageYamlOptions {
  ctx: GeneratorContext;
  region: RegionConfig;
  datacenter: DatacenterConfig;
}

export function generateStorageYaml({ ctx, region, datacenter }: StorageYamlOptions): void {
  const { projectPath, options } = ctx;
  const zonalDir = path.join(
    projectPath,
    "workloads",
    "zonal",
    region.name,
    datacenter.fullName
  );
  const filePath = path.join(zonalDir, "storage.yaml");

  fs.mkdirSync(zonalDir, { recursive: true });

  const nodePrefix = `pve-hub-${region.name}`;
  const isLocal = options.infrastructureTier === "local";

  const content = `# ==============================================================================
# STORAGE SERVICE - ${datacenter.fullName.toUpperCase()} (${region.name.toUpperCase()})
# ==============================================================================
#
# S3-compatible object storage.
# Location: ${region.name}/${datacenter.fullName} (Hub)
#
# ==============================================================================

scope: zonal
region: ${region.name}
datacenter: ${datacenter.fullName}

# ------------------------------------------------------------------------------
# SERVICE DEFINITION
# ------------------------------------------------------------------------------

role: storage                     # What this service provides
implementation: minio             # minio | ceph-rgw (coming soon)

# Version managed by Soverstack - only tested versions allowed
# Current: 2024-07 | Supported: 2024-07, 2024-01

# ------------------------------------------------------------------------------
# INSTANCES
# ------------------------------------------------------------------------------

instances:
  - name: minio-${region.name}-01
    vm_id: 400
    flavor: large
    image: debian-12
    host: ${nodePrefix}-01
${!isLocal ? `
  - name: minio-${region.name}-02
    vm_id: 401
    flavor: large
    image: debian-12
    host: ${nodePrefix}-02` : ""}

# ------------------------------------------------------------------------------
# CONFIGURATION OVERRIDES (optional)
# ------------------------------------------------------------------------------
# See: https://docs.soverstack.io/workloads/storage/minio

overwrite_config:
  # scheduling:
  #   strategy: auto                # manual (default) | auto
  #   host: ${nodePrefix}-01
  #
  # networks:
  #   - vlan: storage
  #
  # minio:
  #   console_port: 9001
  #   erasure_code: true
  #   browser: true
`;

  fs.writeFileSync(filePath, content.trim() + "\n");
}
