// Layer file generators
import { createK8sFile } from "./createK8sFile";
import { createComputeFile } from "./createComputeFile";
import { createCoreComputeFile } from "./createCoreComputeFile";
import { createDatacenterFile } from "./createDatacenterFile";
import { createDatabaseFile } from "./createDatabaseFile";
import { createCoreDatabaseFile } from "./createCoreDatabaseFile";
import { createNetworkingFile } from "./createNetworkingFile";
import { createSecurityFile } from "./createSecurityFile";
import { createObservabilityFile } from "./createObservabilityFile";
import { createAppsFile } from "./createAppsFile";
import { createOrchestratorFile } from "./createOrchestratorFile";
import { createRegionFile } from "./createRegionFile";
import { createRegionalSecurityFile } from "./createRegionalSecurityFile";

// Utility generators
import { createReadme } from "./createReadme";
import { createGitignore } from "./createGitignore";
import { createAppsReadme } from "./createAppsReadme";
import { generatePlatformYaml } from "./generatePlatformYaml";
import { generateSshKeys } from "./generateSshKeys";
import { createSSHConfig } from "./createSSHConfig";
import { createEnv } from "./createEnv";
import { createEnvForDatacenter } from "./createEnvForDatacenter";

import { InfrastructureTierType, ComplianceLevel } from "@/types";
import { DatacenterType } from "./createDatacenterFile";

export {
  // Layer files
  createK8sFile,
  createComputeFile,
  createCoreComputeFile,
  createDatacenterFile,
  createDatabaseFile,
  createCoreDatabaseFile,
  createNetworkingFile,
  createSecurityFile,
  createObservabilityFile,
  createAppsFile,
  createOrchestratorFile,
  createRegionFile,
  createRegionalSecurityFile,
  // Utilities
  createReadme,
  createGitignore,
  createAppsReadme,
  generatePlatformYaml,
  generateSshKeys,
  createSSHConfig,
  createEnv,
  createEnvForDatacenter,
};

export type { DatacenterType };

/**
 * Region configuration
 */
export interface RegionConfig {
  name: string;
  zones: string[];
}

/**
 * Init options for project generation
 */
export interface InitOptions {
  projectName: string;
  domain?: string;
  regions?: RegionConfig[];
  primaryRegion?: string;      // Region where control plane runs
  primaryZone?: string;        // Zone where control plane runs
  generateSshKeys?: boolean;
  infrastructureTier?: InfrastructureTierType;
  complianceLevel?: ComplianceLevel;
  outputDir?: string;
  currentZone?: string;
  datacenterType?: DatacenterType;
}

/**
 * Get the primary region (where control plane runs)
 */
export function getPrimaryRegion(options: InitOptions): RegionConfig {
  const regions = options.regions || [{ name: "eu", zones: ["main"] }];

  // If primaryRegion is specified, find it
  if (options.primaryRegion) {
    const found = regions.find((r) => r.name === options.primaryRegion);
    if (found) return found;
  }

  // Default to first region
  return regions[0];
}

/**
 * Get the primary zone (where control plane runs)
 */
export function getPrimaryZone(options: InitOptions): string {
  // If primaryZone is specified, use it
  if (options.primaryZone) {
    return options.primaryZone;
  }

  // Default to first zone of primary region
  const region = getPrimaryRegion(options);
  return region.zones[0] || "main";
}
