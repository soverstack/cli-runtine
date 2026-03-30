/**
 * Soverstack Validate - Main Logic
 *
 * Orchestrates validation of the project structure.
 * 1. Discover topology from filesystem
 * 2. Parse all YAML files
 * 3. Validate per-file rules
 * 4. Validate cross-file rules
 */

import fs from "fs";
import path from "path";
import yaml from "js-yaml";

import {
  ValidationResult,
  DiscoveredTopology,
  DiscoveredRegion,
  DiscoveredDatacenter,
  ParsedPlatform,
  ParsedRegion,
  ParsedNodes,
  ParsedNetwork,
  ParsedSsh,
  ParsedWorkloadFile,
  createResult,
  addError,
  mergeResults,
} from "./types";

import { validatePlatform } from "./validators/platform";
import { validateRegion, validateTopologyConstraints } from "./validators/region";
import { validateNodes } from "./validators/nodes";
import { validateNetwork } from "./validators/network";
import { validateSsh } from "./validators/ssh";
import { validateWorkloadFile } from "./validators/workloads";
import { validateRequiredWorkloads, validateHaConstraints } from "./validators/crossfile";

// Schema validation (Zod — structural checks)
import {
  validatePlatformSchema,
  validateRegionSchema,
  validateNodesSchema,
  validateNetworkSchema,
  validateSshSchema,
  validateWorkloadSchema,
} from "./schemas/validate";

// ════════════════════════════════════════════════════════════════════════════
// MAIN ENTRY
// ════════════════════════════════════════════════════════════════════════════

export async function validateProject(projectPath: string): Promise<ValidationResult> {
  const result = createResult();
  const absPath = path.resolve(projectPath);

  // ── Check project exists ─────────────────────────────────────────────
  if (!fs.existsSync(absPath)) {
    addError(result, projectPath, "Project directory does not exist");
    return result;
  }

  const platformFile = path.join(absPath, "platform.yaml");
  if (!fs.existsSync(platformFile)) {
    addError(result, "platform.yaml", "platform.yaml not found in project root");
    return result;
  }

  // ════════════════════════════════════════════════════════════════════
  // PHASE 1: Parse and validate platform.yaml
  // ════════════════════════════════════════════════════════════════════
  const platform = loadYaml<ParsedPlatform>(platformFile);
  if (!platform) {
    addError(result, "platform.yaml", "Failed to parse platform.yaml");
    return result;
  }

  // Schema validation (structure, types, formats)
  mergeResults(result, validatePlatformSchema(platform, "platform.yaml"));
  // Logic validation (cross-references, state path, etc.)
  mergeResults(result, validatePlatform(platform, absPath));

  const tier = platform.infrastructure_tier || "production";
  const globalPlacementDc = platform.defaults?.global_placement?.datacenter;
  const flavorNames = (platform.flavors || []).map((f) => f.name).filter(Boolean) as string[];
  const imageNames = (platform.images || []).map((i) => i.name).filter(Boolean) as string[];

  // ════════════════════════════════════════════════════════════════════
  // PHASE 2: Discover topology from filesystem
  // ════════════════════════════════════════════════════════════════════
  const topology = discoverTopology(absPath, tier, globalPlacementDc, flavorNames, imageNames);

  if (topology.regions.length === 0) {
    addError(result, "inventory/", "No regions found in inventory/");
    return result;
  }

  // ════════════════════════════════════════════════════════════════════
  // PHASE 3: Validate each region
  // ════════════════════════════════════════════════════════════════════
  for (const region of topology.regions) {
    // region.yaml
    const regionFile = path.join(region.dirPath, "region.yaml");
    if (!fs.existsSync(regionFile)) {
      addError(result, `inventory/${region.name}/region.yaml`, "region.yaml not found");
      continue;
    }

    const parsedRegion = loadYaml<ParsedRegion>(regionFile);
    if (!parsedRegion) {
      addError(result, `inventory/${region.name}/region.yaml`, "Failed to parse region.yaml");
      continue;
    }

    mergeResults(result, validateRegionSchema(parsedRegion, `inventory/${region.name}/region.yaml`));
    mergeResults(result, validateRegion(parsedRegion, region, topology));

    // Each datacenter in this region
    for (const dc of region.datacenters) {
      const dcDir = dc.dirPath;

      // ── nodes.yaml ───────────────────────────────────────────────
      const nodesFile = path.join(dcDir, "nodes.yaml");
      if (!fs.existsSync(nodesFile)) {
        addError(
          result,
          `inventory/${dc.region}/datacenters/${dc.name}/nodes.yaml`,
          "nodes.yaml not found",
        );
      } else {
        const parsedNodes = loadYaml<ParsedNodes>(nodesFile);
        if (parsedNodes) {
          const nodesRelPath = `inventory/${dc.region}/datacenters/${dc.name}/nodes.yaml`;
          mergeResults(result, validateNodesSchema(parsedNodes, nodesRelPath));
          mergeResults(result, validateNodes(parsedNodes, dc, tier));
          // Collect node names for host validation
          const names = (parsedNodes.nodes || []).map((n) => n.name).filter(Boolean) as string[];
          topology.allNodeNames.set(dc.name, names);
        }
      }

      // ── network.yaml ─────────────────────────────────────────────
      const networkFile = path.join(dcDir, "network.yaml");
      if (!fs.existsSync(networkFile)) {
        addError(
          result,
          `inventory/${dc.region}/datacenters/${dc.name}/network.yaml`,
          "network.yaml not found",
        );
      } else {
        const parsedNetwork = loadYaml<ParsedNetwork>(networkFile);
        if (parsedNetwork) {
          const netRelPath = `inventory/${dc.region}/datacenters/${dc.name}/network.yaml`;
          mergeResults(result, validateNetworkSchema(parsedNetwork, netRelPath));
          mergeResults(result, validateNetwork(parsedNetwork, dc));
        }
      }

      // ── ssh.yaml ─────────────────────────────────────────────────
      const sshFile = path.join(dcDir, "ssh.yaml");
      if (!fs.existsSync(sshFile)) {
        addError(
          result,
          `inventory/${dc.region}/datacenters/${dc.name}/ssh.yaml`,
          "ssh.yaml not found",
        );
      } else {
        const parsedSsh = loadYaml<ParsedSsh>(sshFile);
        if (parsedSsh) {
          const sshRelPath = `inventory/${dc.region}/datacenters/${dc.name}/ssh.yaml`;
          mergeResults(result, validateSshSchema(parsedSsh, sshRelPath));
          mergeResults(result, validateSsh(parsedSsh, dc, absPath));
        }
      }
    }
  }

  // ════════════════════════════════════════════════════════════════════
  // PHASE 4: Topology constraints (uniqueness, control plane)
  // ════════════════════════════════════════════════════════════════════
  mergeResults(result, validateTopologyConstraints(topology));

  // ════════════════════════════════════════════════════════════════════
  // PHASE 5: Validate workloads
  // ════════════════════════════════════════════════════════════════════
  const allVmIds = new Map<number, string>();
  const allInstanceNames = new Map<string, string>();
  const serviceInstanceCounts = new Map<string, number>();

  // Global workloads
  const globalDir = path.join(absPath, "workloads", "global");
  if (fs.existsSync(globalDir)) {
    for (const file of listYamlFiles(globalDir)) {
      const parsed = loadYaml<ParsedWorkloadFile>(file);
      if (parsed) {
        const relPath = path.relative(absPath, file).replace(/\\/g, "/");
        mergeResults(result, validateWorkloadSchema(parsed, relPath));
        const wr = validateWorkloadFile(parsed, {
          filePath: relPath,
          expectedScope: "global",
          topology,
          allVmIds,
          allInstanceNames,
        });
        mergeResults(result, wr);
        collectInstanceCounts(parsed, "global", undefined, undefined, serviceInstanceCounts);
      }
    }
  }

  // Regional workloads
  const regionalDir = path.join(absPath, "workloads", "regional");
  if (fs.existsSync(regionalDir)) {
    for (const region of topology.regions) {
      const regionWorkloadsDir = path.join(regionalDir, region.name);
      if (!fs.existsSync(regionWorkloadsDir)) continue;

      for (const file of listYamlFiles(regionWorkloadsDir)) {
        const parsed = loadYaml<ParsedWorkloadFile>(file);
        if (parsed) {
          const relPath = path.relative(absPath, file).replace(/\\/g, "/");
          mergeResults(result, validateWorkloadSchema(parsed, relPath));
          const wr = validateWorkloadFile(parsed, {
            filePath: relPath,
            expectedScope: "regional",
            expectedRegion: region.name,
            topology,
            allVmIds,
            allInstanceNames,
          });
          mergeResults(result, wr);
          collectInstanceCounts(parsed, "regional", region.name, undefined, serviceInstanceCounts);
        }
      }
    }
  }

  // Zonal workloads
  const zonalDir = path.join(absPath, "workloads", "zonal");
  if (fs.existsSync(zonalDir)) {
    for (const dc of topology.allDatacenters) {
      const dcWorkloadsDir = path.join(zonalDir, dc.region, dc.name);
      if (!fs.existsSync(dcWorkloadsDir)) continue;

      for (const file of listYamlFiles(dcWorkloadsDir)) {
        const parsed = loadYaml<ParsedWorkloadFile>(file);
        if (parsed) {
          const relPath = path.relative(absPath, file).replace(/\\/g, "/");
          mergeResults(result, validateWorkloadSchema(parsed, relPath));
          const wr = validateWorkloadFile(parsed, {
            filePath: relPath,
            expectedScope: "zonal",
            expectedRegion: dc.region,
            expectedDc: dc.name,
            expectedDcType: dc.type,
            topology,
            allVmIds,
            allInstanceNames,
          });
          mergeResults(result, wr);
          collectInstanceCounts(parsed, "zonal", dc.region, dc.name, serviceInstanceCounts);
        }
      }
    }
  }

  // ════════════════════════════════════════════════════════════════════
  // PHASE 6: Cross-file validation
  // ════════════════════════════════════════════════════════════════════
  mergeResults(result, validateRequiredWorkloads(topology));
  mergeResults(result, validateHaConstraints(topology, serviceInstanceCounts));

  return result;
}

// ════════════════════════════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════════════════════════════

function loadYaml<T>(filePath: string): T | null {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    return yaml.load(content) as T;
  } catch {
    return null;
  }
}

function listYamlFiles(dir: string): string[] {
  try {
    return fs
      .readdirSync(dir)
      .filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"))
      .map((f) => path.join(dir, f));
  } catch {
    return [];
  }
}

/**
 * Discover topology by scanning the filesystem
 */
function discoverTopology(
  projectPath: string,
  tier: string,
  globalPlacementDc: string | undefined,
  flavorNames: string[],
  imageNames: string[],
): DiscoveredTopology {
  const inventoryDir = path.join(projectPath, "inventory");
  const regions: DiscoveredRegion[] = [];
  const allDatacenters: DiscoveredDatacenter[] = [];
  const allNodeNames = new Map<string, string[]>();

  if (fs.existsSync(inventoryDir)) {
    const regionDirs = fs
      .readdirSync(inventoryDir, { withFileTypes: true })
      .filter((d) => d.isDirectory());

    for (const regionDir of regionDirs) {
      const regionName = regionDir.name;
      const regionPath = path.join(inventoryDir, regionName);
      const datacentersDir = path.join(regionPath, "datacenters");
      const datacenters: DiscoveredDatacenter[] = [];

      if (fs.existsSync(datacentersDir)) {
        const dcDirs = fs
          .readdirSync(datacentersDir, { withFileTypes: true })
          .filter((d) => d.isDirectory());

        for (const dcDir of dcDirs) {
          const dcName = dcDir.name;
          const dcType = dcName.startsWith("hub-") ? "hub" : "zone";
          const dc: DiscoveredDatacenter = {
            name: dcName,
            type: dcType as "hub" | "zone",
            region: regionName,
            dirPath: path.join(datacentersDir, dcName),
          };
          datacenters.push(dc);
          allDatacenters.push(dc);
        }
      }

      regions.push({
        name: regionName,
        dirPath: regionPath,
        datacenters,
      });
    }
  }

  return {
    projectPath,
    regions,
    allDatacenters,
    allNodeNames,
    flavorNames,
    imageNames,
    globalPlacementDc,
    tier,
  };
}

/**
 * Collect instance counts per service for HA validation
 */
function collectInstanceCounts(
  parsed: ParsedWorkloadFile,
  scope: string,
  region: string | undefined,
  dc: string | undefined,
  counts: Map<string, number>,
): void {
  if (!parsed.services) return;
  for (const svc of parsed.services) {
    if (!svc.role) continue;
    const location = dc ? `${region}/${dc}` : region || "global";
    const key = `${svc.role}:${scope}:${location}`;
    const count = (svc.instances || []).length;
    counts.set(key, (counts.get(key) || 0) + count);
  }
}
