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

// Utility generators
import { createReadme } from "./createReadme";
import { createGitignore } from "./createGitignore";
import { generatePlatformYaml } from "./generatePlatformYaml";
import { generateSshKeys } from "./generateSshKeys";
import { createSSHConfig } from "./createSSHConfig";
import { createEnv } from "./createEnv";
import { createEnvForDatacenter } from "./createEnvForDatacenter";

import { InfrastructureTierType, ComplianceLevel } from "@/types";

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
  // Utilities
  createReadme,
  createGitignore,
  generatePlatformYaml,
  generateSshKeys,
  createSSHConfig,
  createEnv,
  createEnvForDatacenter,
};

export interface InitOptions {
  projectName: string;
  domain?: string;
  datacenters?: string[];
  generateSshKeys?: boolean;
  infrastructureTier?: InfrastructureTierType;
  complianceLevel?: ComplianceLevel;
  outputDir?: string;
  currentDc?: string;
}
