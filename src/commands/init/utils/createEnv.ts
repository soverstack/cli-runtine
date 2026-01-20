import { InitOptions } from "./index";
import fs from "fs";
import path from "path";

/**
 * Create .env file at the specified output directory
 */
export const createEnv = ({ outputDir, projectName }: InitOptions) => {
  const targetDir = outputDir || path.resolve(process.cwd(), projectName);
  const filePath = path.join(targetDir, ".env");

  const content = `# ============================================================
# SOVERSTACK ENVIRONMENT VARIABLES
# ============================================================
# NEVER commit this file to version control!
# ============================================================

# SSH KEYS
SSH_PUBLIC_KEY_PATH=
SSH_PRIVATE_KEY_PATH=

# PROXMOX SERVERS
PROXMOX_API_URL=
PROXMOX_USER=
PROXMOX_PASSWORD=
# ROOT_PASSWORD_PVE01=
# ROOT_PASSWORD_PVE02=
# ROOT_PASSWORD_PVE03=

# DATABASE
POSTGRES_PASSWORD=

# MONITORING
GRAFANA_ADMIN_PASSWORD=

# SECRETS MANAGER (optional)
# VAULT_ROOT_TOKEN=

# SSO (optional)
# KEYCLOAK_ADMIN_PASSWORD=

# CLOUDFLARE (optional, if using hybrid DNS)
# CLOUDFLARE_API_TOKEN=
`;
  fs.writeFileSync(filePath, content);
};
