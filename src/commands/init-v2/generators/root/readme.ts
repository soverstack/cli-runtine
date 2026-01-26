/**
 * Generate README.md
 */

import fs from "fs";
import path from "path";
import { GeneratorContext } from "../../types";

export function generateReadme(ctx: GeneratorContext): void {
  const { projectPath, options } = ctx;
  const filePath = path.join(projectPath, "README.md");

  const regionsStr = options.regions
    .map((r) => `${r.name} (zones: ${r.zones.join(", ")})`)
    .join(", ");

  const content = `# ${options.projectName}

Sovereign infrastructure managed by Soverstack.

## Quick Start

\`\`\`bash
# 1. Fill in credentials
cp .env.example .env
nano .env

# 2. Configure your nodes
nano inventory/${options.primaryRegion}/datacenters/zone-${options.primaryZone}/nodes.yaml

# 3. Validate configuration
soverstack validate

# 4. Deploy
soverstack apply
\`\`\`

## Project Structure

\`\`\`
${options.projectName}/
├── soverstack.yaml          # Global config (flavors, defaults)
├── .env                     # Credentials (NEVER COMMIT)
│
├── inventory/               # Physical infrastructure
│   └── {region}/
│       ├── region.yaml      # Region metadata
│       └── datacenters/
│           ├── hub-*/       # Backup storage
│           │   ├── network.yaml
│           │   └── nodes.yaml
│           └── zone-*/      # Production compute
│               ├── network.yaml
│               └── nodes.yaml
│
└── workloads/               # Services to deploy
    ├── global/              # Unique worldwide (Vault, Keycloak)
    ├── regional/            # Per region (Prometheus, Teleport)
    └── zonal/               # Per datacenter (HAProxy, MinIO)
\`\`\`

## Configuration

| File | Purpose |
|------|---------|
| \`soverstack.yaml\` | Flavors, defaults, state backend |
| \`inventory/ssh.yaml\` | SSH access configuration |
| \`inventory/{region}/region.yaml\` | Region compliance (GDPR) |
| \`workloads/global/*.yaml\` | Global services |
| \`workloads/regional/{region}/*.yaml\` | Regional services |
| \`workloads/zonal/{region}/{dc}/*.yaml\` | Datacenter services |

## Regions

- ${regionsStr}
- Primary: **${options.primaryRegion}/zone-${options.primaryZone}** (control plane)

## Commands

\`\`\`bash
soverstack validate           # Check configuration
soverstack plan               # Preview changes
soverstack apply              # Deploy infrastructure
soverstack destroy            # Remove infrastructure
\`\`\`

## Documentation

- [Soverstack Docs](https://docs.soverstack.io)
`;

  fs.writeFileSync(filePath, content.trim() + "\n");
}
