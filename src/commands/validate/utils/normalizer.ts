import {
  Platform,
  Datacenter,
  ComputeConfig,
  K8sCluster,
  Firewall,
  Bastion,
  Feature,
  IdentityProvider,
  BackendType,
  InfrastructureTierType,
} from "@/types";
import { loadYaml } from "./yaml-loader";
import path from "path";

/**
 * Normalized infrastructure structure - used internally for validation
 * Both "simple" and "advanced" modes are normalized to this format
 */
export interface NormalizedInfrastructure {
  project: {
    name: string;
    environment?: string;
    domain: string;
    infrastructure_tier: InfrastructureTierType;
    version: string;
  };
  datacenter: Datacenter;
  firewall?: Firewall;
  bastion?: Bastion;
  iam?: IdentityProvider;
  compute: ComputeConfig;
  cluster?: K8sCluster;
  features?: Feature;
  ssh?: string; // path to ssh config
  state?: {
    backend: BackendType; // local, aws,gcr
    path: string;
  };
}

/**
 * Normalizes infrastructure configuration to a unified format
 *
 * STRATEGY:
 * - Simple mode: Already in unified format, just extract it
 * - Advanced mode: Load and merge separate layer files
 *
 * @param platform - Platform configuration from platform.yaml
 * @param platformYamlDir - Directory containing platform.yaml (for resolving relative paths)
 * @returns Normalized infrastructure ready for validation
 */
export async function normalizeInfrastructure(
  platform: Platform,
  platformYamlDir: string
): Promise<NormalizedInfrastructure> {
  // Determine if simple or advanced mode
  const isSimpleMode = !platform.layers.compute && !platform.layers.clusters;

  if (isSimpleMode) {
    return await normalizeSimpleMode(platform, platformYamlDir);
  } else {
    return await normalizeAdvancedMode(platform, platformYamlDir);
  }
}

/**
 * Simple mode: Single infrastructure.yaml file
 * Already contains everything in unified format
 */
async function normalizeSimpleMode(
  platform: Platform,
  platformYamlDir: string
): Promise<NormalizedInfrastructure> {
  const infrastructurePath = path.resolve(platformYamlDir, platform.layers as any);
  const infrastructure = await loadYaml<any>(infrastructurePath);

  return {
    project: {
      name: platform.project_name,
      environment: platform.environment,
      domain: platform.domain,
      infrastructure_tier: platform.infrastructure_tier,
      version: platform.version,
    },
    datacenter: infrastructure.datacenter,
    firewall: infrastructure.firewall,
    bastion: infrastructure.bastion,
    iam: infrastructure.iam,
    compute: infrastructure.compute,
    cluster: infrastructure.cluster,
    features: infrastructure.features,
    ssh: infrastructure.ssh || platform.ssh,
    state: infrastructure.state || platform.state,
  };
}

/**
 * Advanced mode: Separate layer files
 * Load each layer and merge into unified structure
 */
async function normalizeAdvancedMode(
  platform: Platform,
  platformYamlDir: string
): Promise<NormalizedInfrastructure> {
  const layers = platform.layers;

  // Load datacenter (required)
  const datacenterPath = path.resolve(platformYamlDir, layers.datacenter);
  const datacenter = await loadYaml<Datacenter>(datacenterPath);

  // Load firewall (optional)
  let firewall: Firewall | undefined;
  if (layers.firewall) {
    const firewallPath = path.resolve(platformYamlDir, layers.firewall);
    firewall = await loadYaml<Firewall>(firewallPath);
  }

  // Load bastion (optional)
  let bastion: Bastion | undefined;
  if (layers.bastions) {
    const bastionPath = path.resolve(platformYamlDir, layers.bastions);
    bastion = await loadYaml<Bastion>(bastionPath);
  }

  // Load IAM (optional)
  let iam: IdentityProvider | undefined;
  if (layers.iam) {
    const iamPath = path.resolve(platformYamlDir, layers.iam);
    iam = await loadYaml<IdentityProvider>(iamPath);
  }
  // Load compute (optional but recommended)
  let compute: ComputeConfig | undefined;
  if (layers.compute) {
    const computePath = path.resolve(platformYamlDir, layers.compute);
    compute = await loadYaml<ComputeConfig>(computePath);
  }

  // Load cluster (optional)
  let cluster: K8sCluster | undefined;
  if (layers.clusters) {
    const clusterPath = path.resolve(platformYamlDir, layers.clusters);
    cluster = await loadYaml<K8sCluster>(clusterPath);
  }

  // Load features (optional)
  let features: Feature | undefined;
  if (layers.features) {
    const featuresPath = path.resolve(platformYamlDir, layers.features);
    features = await loadYaml<Feature>(featuresPath);
  }

  return {
    project: {
      name: platform.project_name,
      environment: platform.environment,
      domain: platform.domain,
      infrastructure_tier: platform.infrastructure_tier,
      version: platform.version,
    },
    datacenter,
    firewall,
    bastion,
    iam,
    compute: compute || {
      instance_type_definitions: [],
      virtual_machines: [],
      linux_containers: [],
    },
    cluster,
    features,
    ssh: platform.ssh,
    state: platform.state,
  };
}
