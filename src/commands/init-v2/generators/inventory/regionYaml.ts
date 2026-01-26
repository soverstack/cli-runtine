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

  const hubName = getHubName(region);
  const isPrimary = region.name === options.primaryRegion;

  // Determine compliance based on region
  let compliance = "none";
  if (region.name === "eu") compliance = "gdpr";
  else if (region.name === "us") compliance = "ccpa";

  const content = `# ════════════════════════════════════════════════════════════════════════════
# REGION: ${region.name.toUpperCase()}
# ════════════════════════════════════════════════════════════════════════════
#
# Region metadata and compliance settings.
#${isPrimary ? "\n# This is the PRIMARY region (hosts global services).\n#" : ""}
# ════════════════════════════════════════════════════════════════════════════

name: ${region.name}
description: "${region.name.toUpperCase()} Region"

# ────────────────────────────────────────────────────────────────────────────
# COMPLIANCE
# ────────────────────────────────────────────────────────────────────────────
# Data residency and compliance requirements.
# Options: none, gdpr, ccpa, hipaa, pci-dss

compliance: ${compliance}
dns_zone: ${region.name}.${options.domain}

# ────────────────────────────────────────────────────────────────────────────
# DATACENTERS
# ────────────────────────────────────────────────────────────────────────────
# List of datacenters in this region.
# - hub: Backup & storage (HDD, MinIO, PBS)
# - zone: Production compute (NVMe, Ceph)

datacenters:
  - name: ${hubName}
    type: hub
    path: ./datacenters/${hubName}

${region.zones
  .map((zone) => {
    const isControlPlane = isPrimary && zone === options.primaryZone;
    return `  - name: zone-${zone}
    type: zone${isControlPlane ? "\n    control_plane: true        # Hosts global services" : ""}
    path: ./datacenters/zone-${zone}`;
  })
  .join("\n\n")}
`;

  fs.writeFileSync(filePath, content.trim() + "\n");
}
