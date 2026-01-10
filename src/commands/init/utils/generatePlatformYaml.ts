import { InitOptions } from "../utils";
import fs from "fs";
import ora from "ora";
import path from "path";

export const generatePlatformYaml = async ({
  projectName,
  environments,
  mode,
  infrastructureTier,
}: InitOptions): Promise<void> => {
  const spinner = ora("Generating platform.yaml").start();
  const projectPath = path.resolve(process.cwd(), projectName);

  try {
    const hasEnv = environments && environments.length > 0;

    if (!hasEnv) {
      const filePath = path.join(projectPath, "platform.yaml");
      const content = getContentPerEnv({ projectName, mode, infrastructureTier });
      fs.writeFileSync(filePath, content);
    } else {
      environments!.forEach((env) => {
        const filePath = path.join(projectPath, `platform-${env}.yaml`);
        const content = getContentPerEnv({ projectName, mode, infrastructureTier, env });
        fs.writeFileSync(filePath, content);
      });
    }

    spinner.succeed("platform.yaml generated");
    spinner.succeed(".env created");
    spinner.succeed("ssh config created");
  } catch (error) {
    spinner.fail("Failed to generate platform.yaml");
    throw error;
  }
};

const getContentPerEnv = ({
  mode,
  projectName,
  infrastructureTier,
  env,
}: InitOptions & { env?: string }): string => {
  const hasEnv = !!env;
  const tier = infrastructureTier || "production";

  let content = `# Soverstack Platform Configuration
# Version: 1.0.0

version: "1.0.0"
project_name: "${projectName}"

# ============================================================
# INFRASTRUCTURE TIER
# ============================================================
# Determines validation requirements and network topology:
# - local: Single node, HA optional, single bridge (vmbr0)
# - production: 3+ servers, HA enforced, 3 networks
# - enterprise: 3+ servers, HA enforced, 5 networks (full isolation)
infrastructure_tier: "${tier}"

`;

  if (hasEnv) {
    content += `# Environment-specific configuration
environment: "${env}"
`;
  }

  if (mode === "advanced") {
    content += `# Layer-based architecture
layers:
`;
    if (hasEnv) {
      content += `  datacenter: "./layers/datacenters/dc-${env}.yaml"
  compute: "./layers/computes/compute-${env}.yaml"
  bastion: "./layers/bastions/bastion-${env}.yaml"
  firewall: "./layers/features/firewall-${env}.yaml"
  iam: "./layers/iam/iam-${env}.yaml"
  cluster: "./layers/clusters/k8s-${env}.yaml"
  features: "./layers/features/features-${env}.yaml"
  observability: "./layers/observability/observability-${env}.yaml"
`;
    } else {
      content += `  datacenter: "./layers/datacenters/datacenter.yaml"
  compute: "./layers/computes/compute.yaml"
  bastion: "./layers/bastions/bastion.yaml"
  firewall: "./layers/firewalls/firewall.yaml"
  iam: "./layers/iam/iam.yaml"
  cluster: "./layers/clusters/k8s.yaml"
  features: "./layers/features/features.yaml"
  observability: "./layers/observability/observability.yaml"
`;
    }
  } else {
    content += `# Simple mode - single file per environment
`;
    if (hasEnv) {
      content += `layers:
    infrastructure: "./layers/infrastructure-${env}.yaml"
    iam: "./layers/iam/iam-${env}.yaml"
    observability: "./layers/observability/observability-${env}.yaml"
    environment: "${env}"
`;
    } else {
      content += `layers:
    infrastructure: "./layers/infrastructure.yaml"
    iam: "./layers/iam/iam.yaml"
    observability: "./layers/observability/observability.yaml"
`;
    }
  }

  content += `
# SSH configuration
ssh: "./ssh_config.yaml"

# State management
# ############################################################
# Documentation: https://docs.soverstack.io/configuration/state-management
# ############################################################
state: 
  backend: "local" # local, s3, gcs, azure
  path: "./.soverstack${hasEnv ? `/${env}/state` : "/state"}"
`;

  return content;
};
