import { InitOptions } from "../utils";
import ora from "ora";
import fs from "fs";
import path from "path";

export const createReadme = async (options: InitOptions): Promise<void> => {
  const spinner = ora("Creating README.md").start();
  const projectPath = path.resolve(process.cwd(), options.projectName);

  try {
    const hasEnv = options.environments && options.environments.length > 0;
    const envList = hasEnv ? options.environments!.join(", ") : "default";

    const filePath = path.join(projectPath, "README.md");
    const content = `# ${options.projectName}

Soverstack infrastructure project

## 📋 Project Information

- **Mode**: ${options.mode}
- **Environments**: ${envList}
- **Created**: ${new Date().toISOString().split("T")[0]}

## 🚀 Quick Start

### 1. Validate Configuration

\`\`\`bash
soverstack validate platform.yaml
\`\`\`

### 2. Generate Plan

\`\`\`bash
soverstack plan
\`\`\`

### 3. Apply Infrastructure

\`\`\`bash
soverstack apply
\`\`\`

## 📁 Project Structure

\`\`\`
${options.projectName}/
├── platform.yaml           # Main configuration file
├── layers/                 # Infrastructure layers
${
  options.mode === "advanced"
    ? `│   ├── datacenters/        # Datacenter configurations
│   ├── computes/           # VM configurations
│   ├── clusters/           # K8s cluster configurations
│   └── features/           # Features (monitoring, logging, etc.)`
    : `│   └── infrastructure.yaml # Simple all-in-one configuration`
}
├── ssh/                    # SSH keys (DO NOT COMMIT!)
└── .soverstack/            # Soverstack internal files
    ├── state/              # State files
    ├── logs/               # Execution logs
    └── cache/              # Cache
\`\`\`

## 🔒 Security Best Practices

⚠️ **IMPORTANT**: Never commit sensitive files to Git!

- ✅ Use environment variables for credentials
- ✅ Use Vault for secrets management
- ✅ Keep SSH keys secure (already in .gitignore)
- ❌ Never commit plain text passwords
- ❌ Never commit \`.env\` files
- ❌ Never commit state files with sensitive data

## 🛠️ Available Commands

\`\`\`bash
# Validate configuration
soverstack validate platform.yaml

# Generate execution plan
soverstack plan

# Apply infrastructure changes
soverstack apply

# Destroy infrastructure
soverstack destroy

# Update DNS records
soverstack dns:update

# Generate dependency graph
soverstack graph

# Generate new SSH keys
soverstack generate:ssh-keys
\`\`\`

## 📚 Documentation

- [Soverstack Documentation](https://docs.soverstack.io)
- [Platform Configuration](./platform.yaml)
- [Layer Architecture](https://docs.soverstack.io/architecture)

## 🤝 Contributing

This project follows Soverstack best practices for infrastructure as code.

---

Generated with ❤️ by Soverstack v1.0.0
`;

    fs.writeFileSync(filePath, content);
    spinner.succeed("README.md created");
  } catch (error) {
    spinner.fail("Failed to create README.md");
    throw error;
  }
};
