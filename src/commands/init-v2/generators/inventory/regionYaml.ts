/**
 * Generate inventory/{region}/region.yaml - Region configuration
 */

import fs from "fs";
import path from "path";
import { GeneratorContext, RegionConfig, getHubName } from "../../types";

interface RegionYamlOptions {
  ctx: GeneratorContext;
  region: RegionConfig;
}

export function generateRegionYaml({ ctx, region }: RegionYamlOptions): void {
  const { projectPath, options } = ctx;
  const regionDir = path.join(projectPath, "inventory", region.name);
  const filePath = path.join(regionDir, "region.yaml");

  // Ensure directory exists
  fs.mkdirSync(regionDir, { recursive: true });

  const isPrimary = region.name === options.primaryRegion;
  const isLocal = options.infrastructureTier === "local";

  // Hub logic:
  // - No hub for local tier
  // - Own hub: hub-{regionName} (hub field matches region name)
  // - Shared hub: references another region's hub
  const hasOwnHub = !isLocal && region.hub === `hub-${region.name}`;
  const hasSharedHub = !isLocal && region.hub && region.hub !== `hub-${region.name}`;

  // Shared hub comment
  let sharedHubComment = "";
  if (hasSharedHub) {
    sharedHubComment = `# Hub: uses ${region.hub} (shared from another region)\n`;
  }

  const content = `# ════════════════════════════════════════════════════════════════════════════
# REGION: ${region.name.toUpperCase()}
# ════════════════════════════════════════════════════════════════════════════
#
# Region metadata and configuration.
#${isPrimary ? "\n# This is the PRIMARY region (hosts global services).\n#" : ""}
# ════════════════════════════════════════════════════════════════════════════

name: ${region.name}
description: "${region.name.toUpperCase()} Region"
dns_zone: ${region.name}.${options.domain}
${!isLocal && region.hub ? `hub: ${region.hub}` : ""}

# ────────────────────────────────────────────────────────────────────────────
# COMPLIANCE (optional, for documentation)
# ────────────────────────────────────────────────────────────────────────────
# Frameworks: gdpr, ccpa, hipaa, pci-dss, hds, soc2, iso27001
#
# Note: Security best practices (encryption, audit, HA) are enforced by
# infrastructure tier, not by compliance setting.

compliance: []
# compliance: [gdpr]
# compliance: [gdpr, pci-dss]

# ────────────────────────────────────────────────────────────────────────────
# DATACENTERS
# ────────────────────────────────────────────────────────────────────────────
# List of datacenters in this region.
# Each datacenter folder must contain: nodes.yaml, network.yaml, ssh.yaml
#${!isLocal ? "\n# - hub: Backup & storage (HDD, MinIO, PBS)" : ""}
# - zone: Production compute (NVMe, Ceph)

${sharedHubComment}datacenters:
${hasOwnHub ? `  - name: hub-${region.name}
    type: hub
    description: "${region.name.toUpperCase()} Hub - Backup & Storage"
    path: ./datacenters/hub-${region.name}

` : ""}${region.zones
  .map((zone) => {
    const isControlPlane = isPrimary && zone === options.primaryZone;
    const zoneDesc = isControlPlane
      ? `${zone.charAt(0).toUpperCase() + zone.slice(1)} Zone - Control Plane`
      : `${zone.charAt(0).toUpperCase() + zone.slice(1)} Zone - Production`;
    return `  - name: zone-${zone}
    type: zone
    description: "${zoneDesc}"${isControlPlane ? "\n    control_plane: true" : ""}
    path: ./datacenters/zone-${zone}`;
  })
  .join("\n\n")}
`;

  fs.writeFileSync(filePath, content.trim() + "\n");
}
