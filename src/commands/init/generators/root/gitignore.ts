/**
 * Generate .gitignore
 */

import fs from "fs";
import path from "path";
import { GeneratorContext } from "../../types";

export function generateGitignore(ctx: GeneratorContext): void {
  const { projectPath } = ctx;
  const filePath = path.join(projectPath, ".gitignore");

  const content = `# ════════════════════════════════════════════════════════════════════════════
# SOVERSTACK GITIGNORE
# ════════════════════════════════════════════════════════════════════════════

# Secrets - NEVER COMMIT
.env
.env.*
!.env.example

# SSH Keys - NEVER COMMIT
.ssh/
*.pem
*.key
id_*
*_soverstack
!*.pub

# Soverstack state and cache
.soverstack/state/
.soverstack/cache/
.soverstack/logs/

# Terraform
*.tfstate
*.tfstate.*
.terraform/
.terraform.lock.hcl
crash.log

# Ansible
*.retry

# IDE
.vscode/
.idea/
*.swp
*.swo
*~

# OS
.DS_Store
Thumbs.db

# Logs
*.log
`;

  fs.writeFileSync(filePath, content.trim() + "\n");
}
