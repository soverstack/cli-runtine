import { InitOptions } from "./index";
import fs from "fs";
import path from "path";
import { isMultiDcFunc } from "../logic";

export const generatePlatformYaml = ({
  projectName,
  domain,
  infrastructureTier,
  outputDir,
  datacenters,
}: InitOptions): void => {
  const tier = infrastructureTier || "production";
  const finalDomain = domain || "example.com";
  const targetDir = outputDir || path.resolve(process.cwd(), projectName);
  const filePath = path.join(targetDir, "platform.yaml");

  const isMultiDc = isMultiDcFunc(datacenters);

  const content = isMultiDc
    ? generateMultiDcPlatformYaml(projectName, tier, finalDomain, datacenters!)
    : generateSingleDcPlatformYaml(projectName, tier, finalDomain);

  fs.writeFileSync(filePath, content);
};

/**
 * Single DC: all layers in same directory
 */
const generateSingleDcPlatformYaml = (projectName: string, tier: string, domain: string): string => {
  return `# ============================================================
# SOVERSTACK PLATFORM CONFIGURATION
# ============================================================
version: "1.0.0"
project_name: "${projectName}"
domain: "${domain}"
infrastructure_tier: "${tier}"

# LAYERS - All paths relative to this file
# Multi-file merge: use comma-separated paths (e.g., "file1.yaml, file2.yaml")
layers:
  datacenter: "./datacenter.yaml"
  compute: "./core-compute.yaml, ./compute.yaml"       # Core VMs + your VMs
  database: "./core-database.yaml, ./database.yaml"    # Core DBs + your DBs
  networking: "./networking.yaml"
  security: "./security.yaml"
  observability: "./observability.yaml"

ssh: "./ssh_config.yaml"

state:
  backend: "local"
  path: "./.soverstack/state"
`;
};

/**
 * Multi-DC: full datacenter configs with explicit paths
 */
const generateMultiDcPlatformYaml = (
  projectName: string,
  tier: string,
  domain: string,
  datacenters: string[]
): string => {
  const dcList = datacenters
    .map((dc, i) => {
      const primary = i === 0 ? "\n    primary: true" : "";
      const p = `./datacenters/${dc}`;
      return `  - name: ${dc}${primary}
    layers:
      datacenter: "${p}/datacenter.yaml"
      compute: "${p}/core-compute.yaml, ${p}/compute.yaml"
      database: "${p}/core-database.yaml, ${p}/database.yaml"
      networking: "${p}/networking.yaml"
      security: "${p}/security.yaml"
      observability: "${p}/observability.yaml"
    ssh: "${p}/ssh_config.yaml"`;
    })
    .join("\n\n");

  return `# ============================================================
# SOVERSTACK PLATFORM CONFIGURATION - MULTI-DATACENTER
# ============================================================
version: "1.0.0"
project_name: "${projectName}"
domain: "${domain}"
infrastructure_tier: "${tier}"

# DATACENTERS
# All paths are explicit - no magic
datacenters:
${dcList}

state:
  backend: "local"
  path: "./.soverstack"
`;
};
