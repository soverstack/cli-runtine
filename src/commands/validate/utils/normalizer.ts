import {
  Platform,
  Datacenter,
  ComputeConfig,
  K8sCluster,
  BackendType,
  InfrastructureTierType,
  NetworkingConfig,
  SecurityConfig,
  ObservabilityConfig,
  DatabasesLayer,
  DatabaseCluster,
  AppsConfig,
  LayerPaths,
  DatacenterEntry,
} from "@/types";
import { loadYaml } from "./yaml-loader";
import path from "path";

// ═══════════════════════════════════════════════════════════════════════════
// MULTI-FILE LAYER MERGE LOGIC
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Error thrown when merging fails due to duplicate non-array properties
 */
export class MergeConflictError extends Error {
  constructor(
    public property: string,
    public file1: string,
    public file2: string
  ) {
    super(
      `Property '${property}' declared in multiple files:\n` +
        `  - ${file1}\n` +
        `  - ${file2}\n\n` +
        `Define '${property}' in one file only.`
    );
    this.name = "MergeConflictError";
  }
}

/**
 * Properties that should be merged as arrays (concatenated)
 */
const ARRAY_MERGE_PROPERTIES: Record<string, string[]> = {
  compute: ["instance_type_definitions", "virtual_machines", "linux_containers"],
  database: ["clusters"], // DatabaseCluster[] - clusters are concatenated
};

/**
 * Parse comma-separated file paths from layer config
 */
function parseLayerPaths(layerConfig: string): string[] {
  return layerConfig
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
}

/**
 * Merge multiple layer files into one
 * - Arrays at root level: concatenate
 * - Non-arrays: error if declared in multiple files
 *
 * SPECIAL CASE FOR DATABASE:
 * - First file should be the full DatabaseCluster (type, version, cluster, databases, credentials)
 * - Additional files can contain just { databases: [...] } to add more DatabaseDefinition[]
 * - The databases arrays are merged into the cluster from the first file
 */
async function mergeLayerFiles<T>(
  filePaths: string[],
  platformYamlDir: string,
  layerName: string
): Promise<{ merged: T; files: string[] }> {
  if (filePaths.length === 0) {
    return { merged: {} as T, files: [] };
  }

  if (filePaths.length === 1) {
    const fullPath = path.resolve(platformYamlDir, filePaths[0]);
    const data = await loadYaml<T>(fullPath);
    return { merged: data, files: [filePaths[0]] };
  }

  const arrayProps = ARRAY_MERGE_PROPERTIES[layerName] || [];
  const merged: Record<string, any> = {};
  const propertySource: Record<string, string> = {};

  for (const filePath of filePaths) {
    const fullPath = path.resolve(platformYamlDir, filePath);
    const data = await loadYaml<Record<string, any>>(fullPath);

    if (!data) continue;

    for (const [key, value] of Object.entries(data)) {
      if (arrayProps.includes(key) && Array.isArray(value)) {
        if (!merged[key]) {
          merged[key] = [];
        }
        merged[key] = [...merged[key], ...value];
        propertySource[key] = filePath;
      } else if (merged[key] !== undefined) {
        throw new MergeConflictError(key, propertySource[key], filePath);
      } else {
        merged[key] = value;
        propertySource[key] = filePath;
      }
    }
  }

  return { merged: merged as T, files: filePaths };
}

/**
 * Merge database layer files
 *
 * DATABASE MERGE STRATEGY:
 * - Each file contains: { clusters: DatabaseCluster[] }
 * - All clusters from all files are concatenated into a single array
 *
 * Result: DatabasesLayer with all clusters merged
 */
async function mergeDatabaseFiles(
  filePaths: string[],
  platformYamlDir: string
): Promise<DatabasesLayer> {
  if (filePaths.length === 0) {
    return { clusters: [] };
  }

  const allClusters: DatabaseCluster[] = [];

  // Load and merge clusters from all files
  for (const filePath of filePaths) {
    const fullPath = path.resolve(platformYamlDir, filePath);
    const data = await loadYaml<DatabasesLayer>(fullPath);

    if (data?.clusters && Array.isArray(data.clusters)) {
      allClusters.push(...data.clusters);
    }
  }

  return { clusters: allClusters };
}

// ═══════════════════════════════════════════════════════════════════════════
// NORMALIZED INFRASTRUCTURE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Normalized datacenter structure - layers for a single datacenter
 */
export interface NormalizedDatacenter {
  name: string;
  datacenter?: Datacenter;
  networking?: NetworkingConfig;
  security?: SecurityConfig;
  compute?: ComputeConfig;
  database?: DatabasesLayer;
  observability?: ObservabilityConfig;
  k8s?: K8sCluster;
  apps?: AppsConfig;
  ssh?: string;
}

/**
 * Normalized infrastructure structure - used internally for validation
 *
 * Supports both single-DC and multi-DC modes:
 * - Single DC: Use `datacenter`, `compute`, etc. directly
 * - Multi-DC: Use `datacenters` array
 */
export interface NormalizedInfrastructure {
  project: {
    name: string;
    domain: string;
    infrastructure_tier: InfrastructureTierType;
    version: string;
  };

  // Multi-DC mode: array of normalized datacenters
  datacenters?: NormalizedDatacenter[];

  // Single-DC mode (legacy): layers at root level
  datacenter?: Datacenter;
  networking?: NetworkingConfig;
  security?: SecurityConfig;
  compute?: ComputeConfig;
  database?: DatabasesLayer;
  observability?: ObservabilityConfig;
  k8s?: K8sCluster;
  apps?: AppsConfig;
  ssh?: string;

  // State config
  state?: {
    backend: BackendType;
    path: string;
  };
}

/**
 * Default layer paths (convention over configuration)
 */
const DEFAULT_LAYER_PATHS: LayerPaths = {
  datacenter: "./datacenter.yaml",
  compute: "./core-compute.yaml, ./compute.yaml",
  database: "./core-database.yaml, ./database.yaml",
  networking: "./networking.yaml",
  security: "./security.yaml",
  observability: "./observability.yaml",
};

/**
 * Normalizes layers from a directory
 */
async function normalizeLayersFromDir(
  baseDir: string,
  layers: LayerPaths
): Promise<Omit<NormalizedDatacenter, "name">> {
  // Load datacenter
  let datacenter: Datacenter | undefined;
  if (layers.datacenter) {
    const datacenterPath = path.resolve(baseDir, layers.datacenter);
    datacenter = await loadYaml<Datacenter>(datacenterPath);
  }

  // Load networking
  let networking: NetworkingConfig | undefined;
  if (layers.networking) {
    const networkingPath = path.resolve(baseDir, layers.networking);
    networking = await loadYaml<NetworkingConfig>(networkingPath);
  }

  // Load security
  let security: SecurityConfig | undefined;
  if (layers.security) {
    const securityPath = path.resolve(baseDir, layers.security);
    security = await loadYaml<SecurityConfig>(securityPath);
  }

  // Load compute with multi-file support
  let compute: ComputeConfig | undefined;
  if (layers.compute) {
    const computePaths = parseLayerPaths(layers.compute);
    const { merged } = await mergeLayerFiles<ComputeConfig>(computePaths, baseDir, "compute");
    compute = {
      instance_type_definitions: merged.instance_type_definitions || [],
      virtual_machines: merged.virtual_machines || [],
      linux_containers: merged.linux_containers || [],
    };
  }

  // Load database with multi-file support
  let database: DatabasesLayer | undefined;
  if (layers.database) {
    const databasePaths = parseLayerPaths(layers.database);
    database = await mergeDatabaseFiles(databasePaths, baseDir);
  }

  // Load observability
  let observability: ObservabilityConfig | undefined;
  if (layers.observability) {
    const observabilityPath = path.resolve(baseDir, layers.observability);
    observability = await loadYaml<ObservabilityConfig>(observabilityPath);
  }

  // Load K8s cluster (optional)
  let k8s: K8sCluster | undefined;
  if (layers.k8s) {
    const k8sPath = path.resolve(baseDir, layers.k8s);
    k8s = await loadYaml<K8sCluster>(k8sPath);
  }

  // Load apps (optional)
  let apps: AppsConfig | undefined;
  if (layers.apps) {
    const appsPath = path.resolve(baseDir, layers.apps);
    apps = await loadYaml<AppsConfig>(appsPath);
  }

  return { datacenter, networking, security, compute, database, observability, k8s, apps };
}

/**
 * Normalizes infrastructure configuration to a unified format
 *
 * Supports both single-DC and multi-DC modes:
 * - Single DC: layers defined in platform.yaml
 * - Multi-DC: datacenters array, files in ./datacenters/{name}/
 *
 * @param platform - Platform configuration from platform.yaml
 * @param platformYamlDir - Directory containing platform.yaml
 * @returns Normalized infrastructure ready for validation
 */
export async function normalizeInfrastructure(
  platform: Platform,
  platformYamlDir: string
): Promise<NormalizedInfrastructure> {
  const baseResult: NormalizedInfrastructure = {
    project: {
      name: platform.project_name,
      domain: platform.domain || "example.com",
      infrastructure_tier: platform.infrastructure_tier,
      version: platform.version,
    },
    state: platform.state,
  };

  // Multi-DC mode: datacenters array with explicit paths
  if (platform.datacenters && platform.datacenters.length > 0) {
    const normalizedDCs: NormalizedDatacenter[] = [];

    for (const dcEntry of platform.datacenters) {
      // Paths are explicit in the config - use platformYamlDir as base
      const dcLayers = await normalizeLayersFromDir(platformYamlDir, dcEntry.layers);

      normalizedDCs.push({
        name: dcEntry.name,
        ...dcLayers,
        ssh: dcEntry.ssh,
      });
    }

    return {
      ...baseResult,
      datacenters: normalizedDCs,
    };
  }

  // Single-DC mode: layers at root level
  if (platform.layers) {
    const layers = await normalizeLayersFromDir(platformYamlDir, platform.layers);

    return {
      ...baseResult,
      ...layers,
      ssh: platform.ssh,
    };
  }

  return baseResult;
}
