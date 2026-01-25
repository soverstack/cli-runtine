import { InitOptions, getPrimaryRegion, getPrimaryZone } from "./index";
import fs from "fs";
import path from "path";

export const generatePlatformYaml = (options: InitOptions): void => {
  const {
    projectName,
    domain,
    infrastructureTier,
    complianceLevel,
    outputDir,
    regions,
  } = options;

  const tier = infrastructureTier || "production";
  const compliance = complianceLevel || "startup";
  const finalDomain = domain || "example.com";
  const targetDir = outputDir || path.resolve(process.cwd(), projectName);
  const filePath = path.join(targetDir, "platform.yaml");

  const primaryRegionName = options.primaryRegion || getPrimaryRegion(options).name;
  const primaryZoneName = options.primaryZone || getPrimaryZone(options);

  // Generate regions list
  const regionsYaml = (regions || [{ name: "eu", zones: ["main"] }])
    .map(
      (r) => `  - name: ${r.name}
    path: ./regions/${r.name}/region.yaml`
    )
    .join("\n\n");

  const content = `# ════════════════════════════════════════════════════════════════════════════
# SOVERSTACK PLATFORM CONFIGURATION
# ════════════════════════════════════════════════════════════════════════════
#
# QUICK START:
#   1. Fill .env with passwords
#   2. Edit regions/${primaryRegionName}/zones/${primaryZoneName}/networking.yaml → add public IPs
#   3. soverstack validate platform.yaml
#   4. soverstack apply platform.yaml
#
# ════════════════════════════════════════════════════════════════════════════
#
# Project Structure:
#
#   platform.yaml           ← You are here
#   .env                    ← Passwords (NEVER COMMIT)
#   │
#   ├── services/           ← Global services
#   │   ├── orchestrator.yaml
#   │   ├── security.yaml
#   │   ├── networking.yaml
#   │   └── observability.yaml
#   │
#   ├── compute.yaml        ← VM specifications
#   ├── database.yaml       ← PostgreSQL config
#   │
#   ├── apps/               ← Optional: customize apps
#   │
#   └── regions/
#       └── {region}/
#           ├── region.yaml
#           ├── security.yaml       (Teleport, Wazuh)
#           ├── observability.yaml  (Prometheus, Loki)
#           ├── compute.yaml
#           │
#           ├── hub/                (Backup - optional)
#           │   ├── datacenter.yaml
#           │   ├── networking.yaml
#           │   └── compute.yaml
#           │
#           └── zones/{zone}/       (Production)
#               ├── datacenter.yaml
#               ├── networking.yaml
#               └── compute.yaml
#
# ════════════════════════════════════════════════════════════════════════════

version: "1.0.0"
project_name: "${projectName}"
domain: "${finalDomain}"                  # REQUIRED - your domain

# ════════════════════════════════════════════════════════════════════════════
# TIER
# ════════════════════════════════════════════════════════════════════════════

infrastructure_tier: "${tier}"            # local | production | enterprise

# ════════════════════════════════════════════════════════════════════════════
# CONTROL PLANE
# ════════════════════════════════════════════════════════════════════════════
# Where global services run (Vault, Keycloak, Grafana, PostgreSQL...)

control_plane:
  region: ${primaryRegionName}
  zone: ${primaryZoneName}

# ════════════════════════════════════════════════════════════════════════════
# GLOBAL SERVICES
# ════════════════════════════════════════════════════════════════════════════

services:
  orchestrator: ./services/orchestrator.yaml
  security: ./services/security.yaml
  networking: ./services/networking.yaml
  observability: ./services/observability.yaml

compute: ./compute.yaml
database: ./database.yaml

# ════════════════════════════════════════════════════════════════════════════
# REGIONS
# ════════════════════════════════════════════════════════════════════════════

regions:
${regionsYaml}

# ════════════════════════════════════════════════════════════════════════════
# STATE
# ════════════════════════════════════════════════════════════════════════════

state:
  backend: local                          # local | s3 | postgres
  path: ./.soverstack
`;

  fs.writeFileSync(filePath, content);
};
