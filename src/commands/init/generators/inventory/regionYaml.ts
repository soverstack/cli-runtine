/**
 * Generate inventory/{region}/region.yaml - Region configuration
 */

import fs from "fs";
import path from "path";
import { GeneratorContext, RegionConfig } from "../../types";

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

  // Hub line
  const hubLine = !isLocal && region.hub ? `hub: ${region.hub}` : "";

  // Shared hub comment
  const hasSharedHub = !isLocal && region.hub && region.hub !== `hub-${region.name}`;
  const sharedHubComment = hasSharedHub ? `# Uses ${region.hub} (shared from another region)\n` : "";

  const content = `# ════════════════════════════════════════════════════════════════════════════
# REGION: ${region.name.toUpperCase()}
# ════════════════════════════════════════════════════════════════════════════
#
# Region metadata and configuration.
#${isPrimary ? "\n# This is the PRIMARY region (hosts global services).\n#" : ""}
# Datacenters are discovered from inventory/${region.name}/datacenters/
# Type is derived from prefix: hub-* = hub, zone-* = zone
#
# ════════════════════════════════════════════════════════════════════════════

name: ${region.name}
description: "${region.name.toUpperCase()} Region"
dns_zone: ${region.name}.${options.domain}
${hubLine}

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
${sharedHubComment}`;

  fs.writeFileSync(filePath, content.trim() + "\n");
}
