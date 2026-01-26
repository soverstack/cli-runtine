/**
 * Generate .env file - All secrets and credentials
 */

import fs from "fs";
import path from "path";
import { GeneratorContext, RegionConfig, DatacenterConfig, getDatacenters } from "../../types";
import { getNodeNames } from "../inventory/nodesYaml";

export function generateEnvFile(ctx: GeneratorContext): void {
  const { projectPath, options } = ctx;
  const filePath = path.join(projectPath, ".env");

  const includeHub = !options.skipHubs;

  // Collect all nodes for bootstrap passwords
  const allNodes: { dcName: string; nodeName: string; envPrefix: string }[] = [];

  options.regions.forEach((region: RegionConfig) => {
    const datacenters = getDatacenters(region, includeHub);
    datacenters.forEach((dc: DatacenterConfig) => {
      const nodeNames = getNodeNames(region, dc, options.infrastructureTier);
      nodeNames.forEach((nodeName) => {
        allNodes.push({
          dcName: dc.fullName,
          nodeName,
          envPrefix: nodeName.toUpperCase().replace(/-/g, "_"),
        });
      });
    });
  });

  // Group nodes by datacenter for display
  const nodesByDc: Record<string, typeof allNodes> = {};
  allNodes.forEach((node) => {
    if (!nodesByDc[node.dcName]) {
      nodesByDc[node.dcName] = [];
    }
    nodesByDc[node.dcName].push(node);
  });

  const content = `# ==============================================================================
# SOVERSTACK ENVIRONMENT VARIABLES
# ==============================================================================
#
# All secrets and credentials for your infrastructure.
#
# NEVER commit this file to version control!
#
# ==============================================================================

# ------------------------------------------------------------------------------
# BOOTSTRAP PASSWORDS (from your provider - Hetzner/OVH)
# ------------------------------------------------------------------------------
# Each server has its own root password provided at provisioning.
# After bootstrap, Soverstack deploys SSH keys and disables password auth.

${Object.entries(nodesByDc)
  .map(
    ([dcName, nodes]) =>
      `# ${dcName}\n${nodes.map((n) => `${n.envPrefix}_BOOTSTRAP_PASSWORD=""`).join("\n")}`
  )
  .join("\n\n")}

# ------------------------------------------------------------------------------
# DATABASE
# ------------------------------------------------------------------------------
POSTGRES_PASSWORD=""

# ------------------------------------------------------------------------------
# SECURITY
# ------------------------------------------------------------------------------
VAULT_ROOT_TOKEN=""
KEYCLOAK_ADMIN_PASSWORD=""

# ------------------------------------------------------------------------------
# OBSERVABILITY
# ------------------------------------------------------------------------------
GRAFANA_ADMIN_PASSWORD=""

# ------------------------------------------------------------------------------
# STORAGE (Hub)
# ------------------------------------------------------------------------------
MINIO_ROOT_PASSWORD=""
PBS_ADMIN_PASSWORD=""
`;

  fs.writeFileSync(filePath, content.trim() + "\n");
}
