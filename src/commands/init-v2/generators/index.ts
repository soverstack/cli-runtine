/**
 * Soverstack Init V2 - Generators Index
 *
 * Re-export all file generators from their respective modules.
 */

// ════════════════════════════════════════════════════════════════════════════
// ROOT LEVEL
// ════════════════════════════════════════════════════════════════════════════
export { generatePlatformYaml } from "./root/platformYaml";
export { generateEnvFile } from "./root/envFile";
export { generateReadme } from "./root/readme";
export { generateGitignore } from "./root/gitignore";

// ════════════════════════════════════════════════════════════════════════════
// INVENTORY
// ════════════════════════════════════════════════════════════════════════════
export {
  generateSshYaml,
  generateSshKeys,
  generateSshKeyPair,
  checkExistingSshKeys,
  SSH_USERS
} from "./inventory/sshYaml";
export { generateRegionYaml } from "./inventory/regionYaml";
export { generateNetworkYaml } from "./inventory/networkYaml";
export { generateNodesYaml, getNodeNames } from "./inventory/nodesYaml";

// ════════════════════════════════════════════════════════════════════════════
// WORKLOADS - GLOBAL
// ════════════════════════════════════════════════════════════════════════════
export { generateDatabaseYaml } from "./workloads/global/databaseYaml";
export { generateDnsYaml } from "./workloads/global/dnsYaml";
export { generateSecretsYaml } from "./workloads/global/secretsYaml";
export { generateIdentityYaml } from "./workloads/global/identityYaml";

// ════════════════════════════════════════════════════════════════════════════
// WORKLOADS - REGIONAL
// ════════════════════════════════════════════════════════════════════════════
export { generateMonitoringYaml } from "./workloads/regional/monitoringYaml";
export { generateBastionYaml } from "./workloads/regional/bastionYaml";
export { generateSiemYaml } from "./workloads/regional/siemYaml";

// ════════════════════════════════════════════════════════════════════════════
// WORKLOADS - ZONAL
// ════════════════════════════════════════════════════════════════════════════
export { generateFirewallYaml } from "./workloads/zonal/firewallYaml";
export { generateLoadbalancerYaml } from "./workloads/zonal/loadbalancerYaml";
export { generateStorageYaml } from "./workloads/zonal/storageYaml";
export { generateBackupYaml } from "./workloads/zonal/backupYaml";
