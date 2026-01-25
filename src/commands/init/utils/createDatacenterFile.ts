import fs from "fs";
import path from "path";
import { InfrastructureTierType } from "@/types";

export type DatacenterType = "zone" | "hub";

export interface DatacenterFileOptions {
  projectName: string;
  infrastructureTier?: InfrastructureTierType;
  outputDir?: string;
  currentZone?: string;
  region?: string;
  datacenterType?: DatacenterType;
}

export const createDatacenterFile = ({
  projectName,
  infrastructureTier,
  outputDir,
  currentZone,
  region,
  datacenterType = "zone",
}: DatacenterFileOptions): void => {
  const targetDir = outputDir || path.resolve(process.cwd(), projectName);
  const filePath = path.join(targetDir, "datacenter.yaml");

  const tier = infrastructureTier || "production";
  const isLocal = tier === "local";
  const regionName = region || "eu";

  if (datacenterType === "hub") {
    createHubDatacenterFile(filePath, regionName, tier);
  } else {
    createZoneDatacenterFile(filePath, currentZone || "main", regionName, isLocal);
  }
};

/**
 * Create a Zone datacenter file (Proxmox + Ceph NVMe)
 */
function createZoneDatacenterFile(
  filePath: string,
  zoneName: string,
  regionName: string,
  isLocal: boolean
): void {
  const zoneUpper = zoneName.toUpperCase();
  const minServers = isLocal ? 1 : 3;

  const content = `# ════════════════════════════════════════════════════════════════════════════
# ZONE CONFIGURATION - ${zoneUpper}
# ════════════════════════════════════════════════════════════════════════════
#
# A Zone is a production cluster (Proxmox + Ceph NVMe) in a specific location.
# Zones belong to a Region and connect to the Region's Hub for backup/DR.
#
# REQUIREMENTS: ${isLocal ? "LOCAL" : "PRODUCTION/ENTERPRISE"}
# - Minimum ${minServers} server(s) for ${isLocal ? "local setup" : "High Availability"}
${!isLocal ? "# - Odd number recommended for quorum\n# - Ceph requires 10 GbE networking" : ""}
#
# ════════════════════════════════════════════════════════════════════════════

name: "${zoneName}"
type: zone
region: "${regionName}"
location: ""                  # e.g., "Falkenstein, DE"
provider: ""                  # e.g., "hetzner", "ovh"

# ────────────────────────────────────────────────────────────────────────────
# PROXMOX SERVERS (PVE Cluster)
# ────────────────────────────────────────────────────────────────────────────
# ip: Public IP for SSH connection (from your hosting provider)
#
servers:
  - name: pve-${zoneName}-01
    id: 1
    ip: ""                    # Public IP (e.g., 51.210.xxx.xxx)
    port: 22
    password:
      type: env
      var_name: "ROOT_PASSWORD_PVE01"
    os: proxmox
    disks:
      type: nvme              # nvme for production performance
      capacity: 2TB
    disk_encryption:
      enabled: false
      password:
        type: env
        var_name: "DISK_ENCRYPTION_PASSWORD"

  # - name: pve-${zoneName}-02
  #   id: 2
  #   ip: ""
  #   port: 22
  #   password:
  #     type: env
  #     var_name: "ROOT_PASSWORD_PVE02"
  #   os: proxmox
  #   disks:
  #     type: nvme
  #     capacity: 2TB
  #   disk_encryption:
  #     enabled: false
  #     password:
  #       type: env
  #       var_name: "DISK_ENCRYPTION_PASSWORD"

  # - name: pve-${zoneName}-03
  #   id: 3
  #   ip: ""
  #   port: 22
  #   password:
  #     type: env
  #     var_name: "ROOT_PASSWORD_PVE03"
  #   os: proxmox
  #   disks:
  #     type: nvme
  #     capacity: 2TB
  #   disk_encryption:
  #     enabled: false
  #     password:
  #       type: env
  #       var_name: "DISK_ENCRYPTION_PASSWORD"
`;

  fs.writeFileSync(filePath, content);
}

/**
 * Create a Hub datacenter file (Backup & Storage - HDD)
 */
function createHubDatacenterFile(
  filePath: string,
  regionName: string,
  tier: string
): void {
  const hubName = `hub-${regionName}`;
  const hubUpper = hubName.toUpperCase();
  const isEnabled = tier === "production" || tier === "enterprise";

  const content = `# ════════════════════════════════════════════════════════════════════════════
# HUB CONFIGURATION - ${hubUpper}
# ════════════════════════════════════════════════════════════════════════════
#
# A Hub centralizes backup, object storage, and DR mirroring for a Region.
# Uses HDD storage for cost-effective high-capacity storage.
#
# Hub is connected to all Zones in the Region for:
# - Proxmox Backup Server (PBS) - VM/CT backups
# - S3-compatible object storage (MinIO/Ceph RGW)
# - Ceph RBD async mirroring for disaster recovery
#
# ════════════════════════════════════════════════════════════════════════════

name: "${hubName}"
type: hub
region: "${regionName}"
enabled: ${isEnabled}                  # ${isEnabled ? "Active" : "Disabled"} for ${tier} tier
location: ""                  # e.g., "Falkenstein, DE"
provider: ""                  # e.g., "hetzner", "ovh"

# ────────────────────────────────────────────────────────────────────────────
# HUB SERVERS (HDD Storage)
# ────────────────────────────────────────────────────────────────────────────
# Servers dedicated to backup and storage services.
# Uses HDD for cost-effective high-capacity storage.
#
servers:
  - name: ${hubName}-01
    id: 100
    ip: ""                    # Public IP for SSH
    port: 22
    password:
      type: env
      var_name: "ROOT_PASSWORD_HUB01"
    os: debian                # Debian for PBS/MinIO
    disks:
      type: hdd               # HDD for cost-effective backup storage
      capacity: 100TB
    disk_encryption:
      enabled: false
      password:
        type: env
        var_name: "DISK_ENCRYPTION_PASSWORD_HUB"

  # - name: ${hubName}-02
  #   id: 101
  #   ip: ""
  #   port: 22
  #   password:
  #     type: env
  #     var_name: "ROOT_PASSWORD_HUB02"
  #   os: debian
  #   disks:
  #     type: hdd
  #     capacity: 100TB
  #   disk_encryption:
  #     enabled: false
  #     password:
  #       type: env
  #       var_name: "DISK_ENCRYPTION_PASSWORD_HUB"

# ────────────────────────────────────────────────────────────────────────────
# HUB SERVICES
# ────────────────────────────────────────────────────────────────────────────
services:
  # Proxmox Backup Server - VM/CT backups from all zones
  backup:
    enabled: ${isEnabled}
    retention:
      daily: 7
      weekly: 4
      monthly: 12

  # S3-compatible object storage (MinIO or Ceph RGW)
  object_storage:
    enabled: ${isEnabled}
    endpoint: ""              # e.g., "s3.${regionName}.example.com"

  # Ceph RBD async mirroring for disaster recovery
  mirroring:
    enabled: ${isEnabled}
    mode: async               # async for cross-datacenter (sync only for <5ms latency)
`;

  fs.writeFileSync(filePath, content);
}
