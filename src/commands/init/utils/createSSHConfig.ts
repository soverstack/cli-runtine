import { InitOptions } from "../utils";
import fs from "fs";
import path from "path";

export const createSSHConfig = ({ projectName }: InitOptions, env?: string) => {
  const fileName = env ? `ssh-config-${env}.yaml` : "ssh-config.yaml";
  const projectPath = path.resolve(process.cwd(), projectName);
  const filePath = path.join(projectPath, fileName);

  const content = `# ############################################################
# 🛡️ SSH INFRASTRUCTURE CONFIGURATION ${env ? `- ${env.toUpperCase()}` : ""}
# ############################################################
# Documentation: https://docs.soverstack.io/configuration/ssh
#
# SECURITY GUIDELINES:
# 1. Follow the "Least Privilege Access" principle.
# 2. Prefer Environment Variables or Vault over local paths.
# 3. NEVER store raw private keys within this repository.
# 
# ############################################################
WE FORCE THE USER TO ROTATE THE SSH KEY EVERY 2 WEEKS; AT LEAST ONE OF THE KEY; we alays need at least to 2 SUDO KEY
AND WE USE knockd to pen the cluster knockd
users:

  # 👤 SYSTEM ADMIN: Primary user for Proxmox and VyOS management
  - user: "soverstack_user"
    groups: "sudo"
    description: "Main infrastructure administrator account"
    ssh_keys:
      # Recommended: Fetch keys from Environment Variables
      public_key_env: "SSH_PUBLIC_KEY"
      private_key_env: "SSH_PRIVATE_KEY"

  # 🤖 CI/CD AUTOMATION: Service account for GitHub Actions / GitLab Runners
  - user: "ci_automation"
    groups: "sudo"
    description: "Automated deployment and maintenance account"
    ssh_keys:
      # High Security: Fetch keys from HashiCorp Vault
      vault_enabled: true
      public_key_vault_path: "secret/data/infra/ssh/ci_public"
      private_key_vault_path: "secret/data/infra/ssh/ci_private"

# ------------------------------------------------------------
# 💡 ALTERNATIVE METHODS (Reference only)
# ------------------------------------------------------------
#  - user: "backup_operator"
#    groups: "ci"
#    # Manual Path Method (Ensure paths are outside the git tree)
#    public_key_path: "/home/admin/.ssh/external_id_rsa.pub"
#    private_key_path: "/home/admin/.ssh/external_id_rsa"

knockd:
  enabled: true
  sequence: 7000,8500,9000,12000
  seq_timeout: 5

`;

  fs.writeFileSync(filePath, content);
};
