import { RegionConfig } from "./index";
import fs from "fs";
import path from "path";

/**
 * Creates a REGIONAL security.yaml file.
 *
 * Simple format: app -> VM IDs + essential infra config
 * For app-specific config (rules, policies), see: apps/teleport.yaml, apps/wazuh.yaml
 */
export const createRegionalSecurityFile = (options: {
  projectName: string;
  infrastructureTier: string;
  regionDir: string;
  regionConfig: RegionConfig;
}): void => {
  const { infrastructureTier, regionDir, regionConfig } = options;
  const regionPath = path.join(regionDir, regionConfig.name);
  const filePath = path.join(regionPath, "security.yaml");

  const isLocal = infrastructureTier === "local";
  const isProd = infrastructureTier === "production" || infrastructureTier === "enterprise";

  // VM IDs based on tier (HA for production)
  const teleportVmIds = isLocal ? "[120]" : "[120, 121]";
  const wazuhVmIds = isLocal ? "[340]" : "[340, 341]";

  const content = `# ════════════════════════════════════════════════════════════════════════════
# REGIONAL SECURITY - ${regionConfig.name.toUpperCase()}
# ════════════════════════════════════════════════════════════════════════════
#
# Security services for this region (data stays in region for GDPR).
#
# VM ID Ranges:
#   Teleport:  120-129  (SSH bastion, session recording)
#   Wazuh:     340-349  (SIEM, threat detection)
#   CrowdSec:  345-349  (collaborative IDS)
#
# For detailed config, create: apps/teleport.yaml, apps/wazuh.yaml
#
# ════════════════════════════════════════════════════════════════════════════

teleport:
  vm_ids: ${teleportVmIds}
  subdomain: ssh
  database: teleport
  vpn_only: true                          # VPN access only

wazuh:
  enabled: ${isProd}
  vm_ids: ${wazuhVmIds}
  subdomain: siem
  database: wazuh
  vpn_only: true                          # VPN access only

crowdsec:
  enabled: ${isProd}
  vm_ids: [345]
`;

  fs.writeFileSync(filePath, content);
};
