/**
 * Generate workloads/zonal/{region}/{hub}/storage.yaml
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
# STORAGE - ${datacenter.fullName.toUpperCase()} (${region.name.toUpperCase()})
# ==============================================================================
#
# S3-compatible object storage.
#
# ==============================================================================

services:
  # ============================================================================
  # STORAGE
  # ============================================================================
  - role: storage
    scope: zonal
    region: ${region.name}
    datacenter: ${datacenter.fullName}
    implementation: minio         # minio | ceph-rgw | seaweedfs
    version: "2024.07"          # 2024.07, 2024.06, 2024.01
    instances:
      - name: storage-${region.name}-01
        vm_id: 400
        flavor: standard
        disk: 1000G
        image: debian-12
        host: ${nodePrefix}-01
${!isLocal ? `
      - name: storage-${region.name}-02
        vm_id: 401
        flavor: standard
        disk: 1000G
        image: debian-12
        host: ${nodePrefix}-02` : ""}
    overwrite_config:
      # console_port: 9001
      # erasure_code: true
      # browser: true
`;

  fs.writeFileSync(filePath, content.trim() + "\n");
}
