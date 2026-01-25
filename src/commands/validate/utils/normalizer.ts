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
  RegionConfig,
  HubConfig,
  ZoneConfig,
  OrchestratorConfig,
  BackupConfig,
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
  database: ["clusters"],
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
 */
async function mergeDatabaseFiles(
  filePaths: string[],
  platformYamlDir: string
): Promise<DatabasesLayer> {
  if (filePaths.length === 0) {
    return { clusters: [] };
  }

  const allClusters: DatabaseCluster[] = [];

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
// NORMALIZED INFRASTRUCTURE - NEW STRUCTURE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Normalized zone structure
 */
export interface NormalizedZone {
  name: string;
  datacenter?: Datacenter;
  networking?: NetworkingConfig;
  compute?: ComputeConfig;
}

/**
 * Normalized hub structure (backup infrastructure)
 */
export interface NormalizedHub {
  name: string;
  backup?: BackupConfig;
  compute?: ComputeConfig;
}

/**
 * Normalized region structure
 */
export interface NormalizedRegion {
  name: string;
  deployed_on: string;  // Zone name where regional VMs are deployed
  observability?: ObservabilityConfig;
  compute?: ComputeConfig;  // Regional VMs (Prometheus, Loki, etc.)
  hub?: NormalizedHub;
  zones: NormalizedZone[];
}

/**
 * Normalized datacenter structure - layers for a single datacenter (legacy)
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
 * Supports three modes:
 * - NEW: regions/hub/zones structure
 * - Single DC: layers at root level (legacy)
 * - Multi-DC: datacenters array (legacy)
 */
export interface NormalizedInfrastructure {
  project: {
    name: string;
    domain: string;
    infrastructure_tier: InfrastructureTierType;
    version: string;
  };

  // ════════════════════════════════════════════════════════════════════════
  // NEW STRUCTURE: Global services + Regions
  // ════════════════════════════════════════════════════════════════════════

  // Global services (unique across all regions)
  orchestrator?: OrchestratorConfig;
  security?: SecurityConfig;
  networking?: NetworkingConfig;  // Global: Headscale, PowerDNS
  observability?: ObservabilityConfig;  // Global: Grafana, Uptime Kuma
  compute?: ComputeConfig;  // Global VMs
  database?: DatabasesLayer;  // Global DB (PostgreSQL)

  // Where global VMs and databases run
  control_plane_runs_on?: {
    region: string;
    zone: string;
  };

  // Regions (new structure)
  regions?: NormalizedRegion[];

  // ════════════════════════════════════════════════════════════════════════
  // LEGACY: Single DC / Multi-DC
  // ════════════════════════════════════════════════════════════════════════

  // Multi-DC mode: array of normalized datacenters
  datacenters?: NormalizedDatacenter[];

  // Single-DC mode (legacy): layers at root level
  datacenter?: Datacenter;
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
 * Load compute config with multi-file support
 */
async function loadComputeConfig(
  computePath: string | undefined,
  baseDir: string
): Promise<ComputeConfig | undefined> {
  if (!computePath) return undefined;

  const computePaths = parseLayerPaths(computePath);
  const { merged } = await mergeLayerFiles<ComputeConfig>(computePaths, baseDir, "compute");
  return {
    instance_type_definitions: merged.instance_type_definitions || [],
    virtual_machines: merged.virtual_machines || [],
    linux_containers: merged.linux_containers || [],
  };
}

/**
 * Load database config with multi-file support
 */
async function loadDatabaseConfig(
  databasePath: string | undefined,
  baseDir: string
): Promise<DatabasesLayer | undefined> {
  if (!databasePath) return undefined;

  const databasePaths = parseLayerPaths(databasePath);
  return mergeDatabaseFiles(databasePaths, baseDir);
}

/**
 * Normalizes layers from a directory (legacy)
 */
async function normalizeLayersFromDir(
  baseDir: string,
  layers: LayerPaths
): Promise<Omit<NormalizedDatacenter, "name">> {
  let datacenter: Datacenter | undefined;
  if (layers.datacenter) {
    const datacenterPath = path.resolve(baseDir, layers.datacenter);
    datacenter = await loadYaml<Datacenter>(datacenterPath);
  }

  let networking: NetworkingConfig | undefined;
  if (layers.networking) {
    const networkingPath = path.resolve(baseDir, layers.networking);
    networking = await loadYaml<NetworkingConfig>(networkingPath);
  }

  let security: SecurityConfig | undefined;
  if (layers.security) {
    const securityPath = path.resolve(baseDir, layers.security);
    security = await loadYaml<SecurityConfig>(securityPath);
  }

  const compute = await loadComputeConfig(layers.compute, baseDir);
  const database = await loadDatabaseConfig(layers.database, baseDir);

  let observability: ObservabilityConfig | undefined;
  if (layers.observability) {
    const observabilityPath = path.resolve(baseDir, layers.observability);
    observability = await loadYaml<ObservabilityConfig>(observabilityPath);
  }

  let k8s: K8sCluster | undefined;
  if (layers.k8s) {
    const k8sPath = path.resolve(baseDir, layers.k8s);
    k8s = await loadYaml<K8sCluster>(k8sPath);
  }

  let apps: AppsConfig | undefined;
  if (layers.apps) {
    const appsPath = path.resolve(baseDir, layers.apps);
    apps = await loadYaml<AppsConfig>(appsPath);
  }

  return { datacenter, networking, security, compute, database, observability, k8s, apps };
}

/**
 * Normalize a zone from the new structure
 */
async function normalizeZone(
  zoneConfig: ZoneConfig,
  regionDir: string
): Promise<NormalizedZone> {
  const zoneDir = zoneConfig.path
    ? path.resolve(regionDir, path.dirname(zoneConfig.path))
    : path.resolve(regionDir, "zones", zoneConfig.name);

  let datacenter: Datacenter | undefined;
  if (zoneConfig.datacenter) {
    datacenter = await loadYaml<Datacenter>(path.resolve(regionDir, zoneConfig.datacenter));
  } else {
    // Default: ./zones/{zone}/datacenter.yaml
    datacenter = await loadYaml<Datacenter>(path.resolve(zoneDir, "datacenter.yaml"));
  }

  let networking: NetworkingConfig | undefined;
  if (zoneConfig.networking) {
    networking = await loadYaml<NetworkingConfig>(path.resolve(regionDir, zoneConfig.networking));
  } else {
    networking = await loadYaml<NetworkingConfig>(path.resolve(zoneDir, "networking.yaml"));
  }

  const compute = await loadComputeConfig(
    zoneConfig.compute || "./core-compute.yaml",
    zoneDir
  );

  return {
    name: zoneConfig.name,
    datacenter,
    networking,
    compute,
  };
}

/**
 * Normalize a hub from the new structure
 */
async function normalizeHub(
  hubConfig: HubConfig,
  regionDir: string
): Promise<NormalizedHub> {
  const hubDir = hubConfig.path
    ? path.resolve(regionDir, path.dirname(hubConfig.path))
    : path.resolve(regionDir, "hub");

  let backup: BackupConfig | undefined;
  // Load backup.yaml if exists
  backup = await loadYaml<BackupConfig>(path.resolve(hubDir, "backup.yaml"));

  const compute = await loadComputeConfig(
    hubConfig.compute || "./core-compute.yaml",
    hubDir
  );

  return {
    name: hubConfig.name || "hub",
    backup: hubConfig.backup || backup,
    compute,
  };
}

/**
 * Normalize a region from the new structure
 */
async function normalizeRegion(
  regionPath: string,
  platformDir: string
): Promise<NormalizedRegion> {
  const regionConfig = await loadYaml<RegionConfig>(path.resolve(platformDir, regionPath));
  if (!regionConfig) {
    throw new Error(`Failed to load region config from ${regionPath}`);
  }

  const regionDir = path.resolve(platformDir, path.dirname(regionPath));

  // Load regional observability
  let observability: ObservabilityConfig | undefined;
  if (regionConfig.observability) {
    observability = await loadYaml<ObservabilityConfig>(
      path.resolve(regionDir, regionConfig.observability)
    );
  }

  // Load regional compute
  const compute = await loadComputeConfig(regionConfig.compute, regionDir);

  // Normalize hub
  let hub: NormalizedHub | undefined;
  if (regionConfig.hub) {
    hub = await normalizeHub(regionConfig.hub, regionDir);
  }

  // Normalize zones
  const zones: NormalizedZone[] = [];
  for (const zoneConfig of regionConfig.zones || []) {
    const normalizedZone = await normalizeZone(zoneConfig, regionDir);
    zones.push(normalizedZone);
  }

  return {
    name: regionConfig.name,
    deployed_on: regionConfig.deployed_on,
    observability,
    compute,
    hub,
    zones,
  };
}

/**
 * Normalizes infrastructure configuration to a unified format
 *
 * Supports three modes:
 * - NEW: regions structure (platform.regions defined)
 * - Single DC: layers at root level (platform.layers defined)
 * - Multi-DC: datacenters array (platform.datacenters defined)
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

  // ════════════════════════════════════════════════════════════════════════
  // NEW STRUCTURE: Regions
  // ════════════════════════════════════════════════════════════════════════
  if (platform.regions && platform.regions.length > 0) {
    // Load global services
    let orchestrator: OrchestratorConfig | undefined;
    if (platform.orchestrator) {
      orchestrator = await loadYaml<OrchestratorConfig>(
        path.resolve(platformYamlDir, platform.orchestrator)
      );
    }

    let security: SecurityConfig | undefined;
    if (platform.security) {
      security = await loadYaml<SecurityConfig>(
        path.resolve(platformYamlDir, platform.security)
      );
    }

    let networking: NetworkingConfig | undefined;
    if (platform.networking) {
      networking = await loadYaml<NetworkingConfig>(
        path.resolve(platformYamlDir, platform.networking)
      );
    }

    let observability: ObservabilityConfig | undefined;
    if (platform.observability) {
      observability = await loadYaml<ObservabilityConfig>(
        path.resolve(platformYamlDir, platform.observability)
      );
    }

    const compute = await loadComputeConfig(platform.compute, platformYamlDir);
    const database = await loadDatabaseConfig(platform.database, platformYamlDir);

    // Normalize regions
    const regions: NormalizedRegion[] = [];
    for (const regionRef of platform.regions) {
      const normalizedRegion = await normalizeRegion(regionRef.path, platformYamlDir);
      regions.push(normalizedRegion);
    }

    return {
      ...baseResult,
      orchestrator,
      security,
      networking,
      observability,
      compute,
      database,
      control_plane_runs_on: platform.control_plane_runs_on,
      regions,
      ssh: platform.ssh,
    };
  }

  // ════════════════════════════════════════════════════════════════════════
  // LEGACY: Multi-DC mode
  // ════════════════════════════════════════════════════════════════════════
  if (platform.datacenters && platform.datacenters.length > 0) {
    const normalizedDCs: NormalizedDatacenter[] = [];

    for (const dcEntry of platform.datacenters) {
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

  // ════════════════════════════════════════════════════════════════════════
  // LEGACY: Single-DC mode
  // ════════════════════════════════════════════════════════════════════════
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
