import { InitOptions } from "../utils";
import ora from "ora";
import fs from "fs";
import path from "path";

export const createGitignore = ({ projectName }: InitOptions) => {
  const spinner = ora("Creating .gitignore").start();
  const projectPath = path.resolve(process.cwd(), projectName);

  try {
    const filePath = path.join(projectPath, ".gitignore");
    const content = `# ═══════════════════════════════════════════════════════════════════════════
# SOVERSTACK - GITIGNORE
# ═══════════════════════════════════════════════════════════════════════════

# ─────────────────────────────────────────────────────────────────────────────
# 🔒 SECURITY - NEVER COMMIT THESE FILES!
# ─────────────────────────────────────────────────────────────────────────────

# SSH Keys (CRITICAL - Private keys must never be committed!)
ssh/id_rsa
ssh/id_rsa.pub
ssh/*.pem
ssh/*.key
*.pem
*.key

# Environment Variables (May contain secrets)
.env
.env.* 

# State Files (May contain sensitive data)
.soverstack/state/
*.tfstate
*.tfstate.*

# Credentials
credentials.json
secrets.yaml
vault-keys.json

# ─────────────────────────────────────────────────────────────────────────────
# Working Directories
# ─────────────────────────────────────────────────────────────────────────────

# Soverstack internal
.soverstack/logs/
.soverstack/cache/
.soverstack/tmp/

# Terraform
.terraform/
.terraform.lock.hcl

# Ansible
*.retry
.ansible/

# ─────────────────────────────────────────────────────────────────────────────
# IDE & Editors
# ─────────────────────────────────────────────────────────────────────────────

.vscode/
.idea/
*.swp
*.swo
*~
.DS_Store

# ─────────────────────────────────────────────────────────────────────────────
# Logs
# ─────────────────────────────────────────────────────────────────────────────

*.log
logs/
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# ─────────────────────────────────────────────────────────────────────────────
# Backup Files
# ─────────────────────────────────────────────────────────────────────────────

*.backup
*.bak
*.old
`;

    fs.writeFileSync(filePath, content);
    spinner.succeed(".gitignore created");
  } catch (error) {
    spinner.fail("Failed to create .gitignore");
    throw error;
  }
};
