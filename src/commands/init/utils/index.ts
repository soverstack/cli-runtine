// how to import and export directly functions from other files

import { createBastionFile } from "./createBastionFile";
import { createFirewallFile } from "./createFirewallFile";
import { createFeatureFile } from "./createFeatureFile";

import { createClusterFile } from "./createClusterFile";
import { createComputeFile } from "./createComputeFile";
import { createDatacenterFile } from "./createDatacenterFile";

import { createReadme } from "./createReadme";
import { createGitignore } from "./createGitignore";
import { createSimpleLayerFile } from "./createSimpleLayerFile";
import { generatePlatformYaml } from "./generatePlatformYaml";
import { generateSshKeys } from "./generateSshKeys";
import { createSSHConfig } from "./createSSHConfig";
import { createEnv } from "./createEnv";
import { createObservabilityFile } from "./createObservabilityFile";
import { createIAMFile } from "./createIAMFile";

import { InfrastructureTierType } from "@/types";
export {
  createBastionFile,
  createFirewallFile,
  createFeatureFile,
  createClusterFile,
  createComputeFile,
  createDatacenterFile,
  createReadme,
  createSimpleLayerFile,
  createGitignore,
  generatePlatformYaml,
  generateSshKeys,
  createSSHConfig,
  createEnv,
  createObservabilityFile,
  createIAMFile,
};

export interface InitOptions {
  projectName: string;
  environments?: string[]; // Optional: if undefined, no env-specific files
  mode: "simple" | "advanced";
  generateSshKeys?: boolean;
  infrastructureTier?: InfrastructureTierType; // Infrastructure complexity tier
}
