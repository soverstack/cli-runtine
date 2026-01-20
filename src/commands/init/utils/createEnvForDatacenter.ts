import fs from "fs";
import path from "path";

export const createEnvForDatacenter = (dcDir: string, dc: string): void => {
  const filePath = path.join(dcDir, ".env");
  const dcUpper = dc.toUpperCase();

  const content = `# ============================================================
# SOVERSTACK - DATACENTER: ${dcUpper}
# ============================================================
# NEVER commit this file to version control!
# ============================================================

# SSH KEYS
SSH_PUBLIC_KEY_PATH=
SSH_PRIVATE_KEY_PATH=

# PROXMOX
PROXMOX_API_URL=
PROXMOX_USER=
PROXMOX_PASSWORD=

# DATABASE
POSTGRES_PASSWORD=

# MONITORING
GRAFANA_ADMIN_PASSWORD=
`;
  fs.writeFileSync(filePath, content);
};
