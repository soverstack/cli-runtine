import { InitOptions } from "./index";
import fs from "fs";
import path from "path";

export const createDatacenterFile = ({
  projectName,
  infrastructureTier,
  outputDir,
  currentDc,
}: InitOptions): void => {
  const targetDir = outputDir || path.resolve(process.cwd(), projectName);
  const filePath = path.join(targetDir, "datacenter.yaml");

  const isLocal = infrastructureTier === "local";
  const minServers = isLocal ? 1 : 3;

  // Datacenter naming
  const dcName = currentDc || "main";
  const dcUpper = dcName.toUpperCase();

  const content = `# ════════════════════════════════════════════════════════════════════════════
# DATACENTER CONFIGURATION${currentDc ? ` - ${dcUpper}` : ""}
# ════════════════════════════════════════════════════════════════════════════
#
# Physical infrastructure layer - Proxmox servers and backup servers
#
# REQUIREMENTS: ${isLocal ? "LOCAL" : "PRODUCTION/ENTERPRISE"}
# - Minimum ${minServers} server(s) for ${isLocal ? "local setup" : "High Availability"}
${!isLocal ? "# - Odd number recommended for quorum\n# - Ceph requires 10 GbE networking" : ""}
#
# ════════════════════════════════════════════════════════════════════════════

name: "${dcName}"
location: ""  # e.g., "Paris, France"

# ────────────────────────────────────────────────────────────────────────────
# PROXMOX SERVERS (PVE Cluster)
# ────────────────────────────────────────────────────────────────────────────
# ip: Public IP for SSH connection (from your hosting provider)
servers:
  - name: pve-${dcName}-01
    id: 1
    ip: ""            # Public IP (e.g., 51.210.xxx.xxx)
    port: 22
    password:
      type: env
      var_name: "ROOT_PASSWORD_PVE01"
    os: proxmox
    disk_encryption:
      enabled: false
      password:
        type: env
        var_name: "DISK_ENCRYPTION_PASSWORD"

  # - name: pve-${dcName}-02
  #   id: 2
  #   ip: ""          # Public IP
  #   port: 22
  #   password:
  #     type: env
  #     var_name: "ROOT_PASSWORD_PVE02"
  #   os: proxmox
  #   disk_encryption:
  #     enabled: false
  #     password:
  #       type: env
  #       var_name: "DISK_ENCRYPTION_PASSWORD"

  # - name: pve-${dcName}-03
  #   id: 3
  #   ip: ""          # Public IP
  #   port: 22
  #   password:
  #     type: env
  #     var_name: "ROOT_PASSWORD_PVE03"
  #   os: proxmox
  #   disk_encryption:
  #     enabled: false
  #     password:
  #       type: env
  #       var_name: "DISK_ENCRYPTION_PASSWORD"

# ------------------------------------------------------------
# BACKUP SERVERS (Outside PVE cluster)
# ------------------------------------------------------------
backup_servers:
  - name: backup-${dcName}-01
    id: 100
    ip: ""            # Public IP for SSH connection
    port: 22
    password:
      type: env
      var_name: "ROOT_PASSWORD_BACKUP01"
    os: debian
    disk_encryption:
      enabled: false
      password:
        type: env
        var_name: "DISK_ENCRYPTION_PASSWORD"

# ------------------------------------------------------------
# STORAGE BACKENDS (Optional - for S3-compatible backup storage)
# ------------------------------------------------------------
# Uncomment when you have MinIO or other S3-compatible storage
#
# storage_backends:
#   backup-main:
#     server: backup-${dcName}-01
#     type: s3
#     endpoint: ""         # e.g., "10.0.30.1:9000"
#     bucket_prefix: backups-${dcName}
`;

  fs.writeFileSync(filePath, content);
};
