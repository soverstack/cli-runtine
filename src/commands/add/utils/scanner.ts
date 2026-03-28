/**
 * Inventory & Workload Scanner
 *
 * Utilities to discover existing regions, datacenters, and workloads
 * by reading region.yaml files and following datacenter paths.
 */

import fs from "fs";
import path from "path";
import yaml from "js-yaml";

// ════════════════════════════════════════════════════════════════════════════
// TYPES
// ════════════════════════════════════════════════════════════════════════════

export interface ScannedDatacenter {
  name: string;
  fullName: string;
  type: "hub" | "zone";
  description: string;
  control_plane?: boolean;
  path: string;
}

export interface ScannedRegion {
  name: string;
  description: string;
  dns_zone?: string;
  hub?: string;
  compliance: string[];
  path: string;
  datacenters: ScannedDatacenter[];
  hubs: ScannedDatacenter[];
  zones: ScannedDatacenter[];
}

export interface ScannedProject {
  projectPath: string;
  regions: ScannedRegion[];
  allDatacenters: ScannedDatacenter[];
}

// ════════════════════════════════════════════════════════════════════════════
// REGION.YAML STRUCTURE
// ════════════════════════════════════════════════════════════════════════════

interface RegionYamlDatacenter {
  name: string;
  type: "hub" | "zone";
  description?: string;
  control_plane?: boolean;
  path: string;
}

interface RegionYaml {
  name: string;
  description?: string;
  dns_zone?: string;
  hub?: string;
  compliance?: string[];
  datacenters: RegionYamlDatacenter[];
}

// ════════════════════════════════════════════════════════════════════════════
// SCANNER
// ════════════════════════════════════════════════════════════════════════════

/**
 * Scan project to discover all regions and datacenters
 * Reads region.yaml files and follows datacenter paths defined inside.
 */
export function scanProject(projectPath: string): ScannedProject {
  const inventoryPath = path.join(projectPath, "inventory");
  const regions: ScannedRegion[] = [];
  const allDatacenters: ScannedDatacenter[] = [];

  if (!fs.existsSync(inventoryPath)) {
    return { projectPath, regions, allDatacenters };
  }

  // Scan region folders (folders with region.yaml)
  const regionFolders = fs.readdirSync(inventoryPath).filter((f) => {
    const fullPath = path.join(inventoryPath, f);
    const stat = fs.statSync(fullPath);
    return (
      stat.isDirectory() &&
      !f.startsWith(".") &&
      fs.existsSync(path.join(fullPath, "region.yaml"))
    );
  });

  for (const regionFolderName of regionFolders) {
    const regionPath = path.join(inventoryPath, regionFolderName);
    const regionYamlPath = path.join(regionPath, "region.yaml");

    // Read region.yaml
    let regionYaml: RegionYaml;
    try {
      const content = fs.readFileSync(regionYamlPath, "utf-8");
      regionYaml = yaml.load(content) as RegionYaml;
    } catch {
      // Invalid region.yaml, skip
      continue;
    }

    if (!regionYaml || !regionYaml.name) {
      continue;
    }

    const datacenters: ScannedDatacenter[] = [];
    const hubs: ScannedDatacenter[] = [];
    const zones: ScannedDatacenter[] = [];

    // Follow datacenter paths from region.yaml
    if (regionYaml.datacenters && Array.isArray(regionYaml.datacenters)) {
      for (const dcEntry of regionYaml.datacenters) {
        // Resolve relative path from region folder
        const dcPath = path.resolve(regionPath, dcEntry.path);

        // Check if datacenter folder exists and has required files
        if (!fs.existsSync(dcPath) || !fs.existsSync(path.join(dcPath, "nodes.yaml"))) {
          continue;
        }

        const dc: ScannedDatacenter = {
          name: dcEntry.name.startsWith("hub-")
            ? dcEntry.name.replace("hub-", "")
            : dcEntry.name.replace("zone-", ""),
          fullName: dcEntry.name,
          type: dcEntry.type,
          description: dcEntry.description || "",
          control_plane: dcEntry.control_plane,
          path: dcPath,
        };

        datacenters.push(dc);
        allDatacenters.push(dc);

        if (dcEntry.type === "hub") {
          hubs.push(dc);
        } else {
          zones.push(dc);
        }
      }
    }

    regions.push({
      name: regionYaml.name,
      description: regionYaml.description || "",
      dns_zone: regionYaml.dns_zone,
      hub: regionYaml.hub,
      compliance: regionYaml.compliance || [],
      path: regionPath,
      datacenters,
      hubs,
      zones,
    });
  }

  return { projectPath, regions, allDatacenters };
}

/**
 * Check if a region exists
 */
export function regionExists(projectPath: string, regionName: string): boolean {
  const regionPath = path.join(projectPath, "inventory", regionName, "region.yaml");
  return fs.existsSync(regionPath);
}

/**
 * Check if a datacenter exists in a region
 */
export function datacenterExists(
  projectPath: string,
  regionName: string,
  dcName: string
): boolean {
  const dcPath = path.join(projectPath, "inventory", regionName, "datacenters", dcName);
  return fs.existsSync(dcPath);
}

/**
 * Get the next zone index for VM ID calculation
 */
export function getNextZoneIndex(projectPath: string, regionName: string): number {
  const project = scanProject(projectPath);
  const region = project.regions.find((r) => r.name === regionName);
  if (!region) return 0;
  return region.zones.length;
}

/**
 * Find project root by looking for platform.yaml
 */
export function findProjectRoot(startPath: string = process.cwd()): string | null {
  let currentPath = startPath;

  while (currentPath !== path.dirname(currentPath)) {
    if (fs.existsSync(path.join(currentPath, "platform.yaml"))) {
      return currentPath;
    }
    currentPath = path.dirname(currentPath);
  }

  return null;
}

// ════════════════════════════════════════════════════════════════════════════
// FULL INVENTORY LOADER (with merged data)
// ════════════════════════════════════════════════════════════════════════════

import type {
  Inventory,
  InventoryRegion,
  InventoryDatacenter,
  InventoryNode,
  InventoryVlan,
  InventoryPublicIps,
  InventorySshUser,
  InventoryKnockd,
  InventoryRotationPolicy,
  InventoryCeph,
} from "../../init/types";

/**
 * Load full inventory with merged datacenter data
 * Reads region.yaml → follows paths → merges nodes.yaml, network.yaml, ssh.yaml
 */
export function loadInventory(projectPath: string): Inventory {
  const project = scanProject(projectPath);
  const regions: InventoryRegion[] = [];

  for (const scannedRegion of project.regions) {
    const datacenters: InventoryDatacenter[] = [];

    for (const scannedDc of scannedRegion.datacenters) {
      const dcPath = scannedDc.path;

      // Load nodes.yaml
      const nodesYamlPath = path.join(dcPath, "nodes.yaml");
      let nodes: InventoryNode[] = [];
      let ceph: InventoryCeph | undefined;
      if (fs.existsSync(nodesYamlPath)) {
        try {
          const content = yaml.load(fs.readFileSync(nodesYamlPath, "utf-8")) as any;
          nodes = content?.nodes || [];
          ceph = content?.ceph;
        } catch {
          // Invalid nodes.yaml
        }
      }

      // Load network.yaml
      const networkYamlPath = path.join(dcPath, "network.yaml");
      let vlans: InventoryVlan[] = [];
      let publicIps: InventoryPublicIps | undefined;
      if (fs.existsSync(networkYamlPath)) {
        try {
          const content = yaml.load(fs.readFileSync(networkYamlPath, "utf-8")) as any;
          vlans = content?.vlans || [];
          publicIps = content?.public_ips;
        } catch {
          // Invalid network.yaml
        }
      }

      // Load ssh.yaml
      const sshYamlPath = path.join(dcPath, "ssh.yaml");
      let users: InventorySshUser[] = [];
      let knockd: InventoryKnockd = {
        enabled: true,
        sequence: [7000, 8500, 9000, 12000],
        seq_timeout: 5,
        port_timeout: 30,
      };
      let rotationPolicy: InventoryRotationPolicy = {
        max_age_days: 90,
        warning_days: 14,
      };
      if (fs.existsSync(sshYamlPath)) {
        try {
          const content = yaml.load(fs.readFileSync(sshYamlPath, "utf-8")) as any;
          users = content?.users || [];
          if (content?.knockd) knockd = content.knockd;
          if (content?.rotation_policy) rotationPolicy = content.rotation_policy;
        } catch {
          // Invalid ssh.yaml
        }
      }

      datacenters.push({
        name: scannedDc.fullName,
        type: scannedDc.type,
        nodes,
        ceph,
        vlans,
        public_ips: publicIps,
        rotation_policy: rotationPolicy,
        knockd,
        users,
      });
    }

    regions.push({
      name: scannedRegion.name,
      description: scannedRegion.description,
      dns_zone: scannedRegion.dns_zone || "",
      hub: scannedRegion.hub,
      compliance: scannedRegion.compliance,
      datacenters,
    });
  }

  return { regions };
}
