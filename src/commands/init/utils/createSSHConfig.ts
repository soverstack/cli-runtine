import { InitOptions } from "./index";
import fs from "fs";
import path from "path";

export const createSSHConfig = ({
  projectName,
  infrastructureTier,
  outputDir,
  currentDc,
}: InitOptions): void => {
  const targetDir = outputDir || path.resolve(process.cwd(), projectName);
  const filePath = path.join(targetDir, "ssh_config.yaml");
  const tier = infrastructureTier || "production";

  // Header suffix for display
  const dcUpper = currentDc ? currentDc.toUpperCase() : "";
  const headerSuffix = dcUpper ? ` - ${dcUpper}` : "";

  // Rotation days based on tier
  const rotationDays = getRotationDays(tier);

  const content = `# ============================================================
# SSH CONFIGURATION${headerSuffix}
# ============================================================
#
# Structure matches SSHKeys type:
#   user: string
#   public_key: CredentialRef  (type: vault | env | file)
#   private_key: CredentialRef (type: vault | env | file)
#   groups: UserGroupType      (sudo | docker | kvm | systemd-journal | adm)
#
# SECURITY REQUIREMENTS:
# 1. Minimum 2 sudo-enabled users required
# 2. SSH key rotation is ENFORCED
# 3. knockd is REQUIRED - SSH port is closed by default
# 4. NEVER store raw private keys in this repository
#
# ============================================================

# ------------------------------------------------------------
# KEY ROTATION POLICY
# ------------------------------------------------------------
rotation_policy:
  max_age_days: ${rotationDays.max}
  warning_days: ${rotationDays.warning}
  # Tier: ${tier}

# ------------------------------------------------------------
# KNOCKD CONFIGURATION
# ------------------------------------------------------------
# To connect: knock -v <host> 7000 8500 9000 12000 && ssh user@host
knockd:
  enabled: true
  interface: eth0
  sequence:
    - 7000
    - 8500
    - 9000
    - 12000
  seq_timeout: 5
  port_timeout: 30

# ------------------------------------------------------------
# SSH USERS (SSHKeys[] structure)
# ------------------------------------------------------------
# Minimum 2 sudo users required for redundancy.
#
users:
  # Primary administrator
  - user: "soverstack_admin"
    groups: sudo
    public_key:
      type: env
      var_name: "SSH_PUBLIC_KEY"
    private_key:
      type: env
      var_name: "SSH_PRIVATE_KEY"

  # Backup administrator
  - user: "soverstack_backup"
    groups: sudo
    public_key:
      type: env
      var_name: "SSH_PUBLIC_KEY_BACKUP"
    private_key:
      type: env
      var_name: "SSH_PRIVATE_KEY_BACKUP"
`;

  fs.writeFileSync(filePath, content);
};

/**
 * Get rotation days based on infrastructure tier
 */
function getRotationDays(tier: string): { max: number; warning: number } {
  switch (tier) {
    case "local":
      return { max: 365, warning: 60 };
    case "enterprise":
      return { max: 60, warning: 7 };
    case "production":
    default:
      return { max: 90, warning: 14 };
  }
}
