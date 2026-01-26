/**
 * Generate workloads/global/identity.yaml - Keycloak
 */

import fs from "fs";
import path from "path";
import { GeneratorContext } from "../../../types";

export function generateIdentityYaml(ctx: GeneratorContext): void {
  const { projectPath, options } = ctx;
  const globalDir = path.join(projectPath, "workloads", "global");
  const filePath = path.join(globalDir, "identity.yaml");

  fs.mkdirSync(globalDir, { recursive: true });

  const primaryNodePrefix = `pve-${options.primaryRegion}-${options.primaryZone}`;
  const isLocal = options.infrastructureTier === "local";

  const content = `# ==============================================================================
# IDENTITY SERVICE
# ==============================================================================
#
# Identity management and SSO.
# Location: ${options.primaryRegion}/zone-${options.primaryZone}
#
# ==============================================================================

scope: global

# ------------------------------------------------------------------------------
# SERVICE DEFINITION
# ------------------------------------------------------------------------------

role: identity                    # What this service provides
implementation: keycloak          # keycloak | authentik (coming soon) | zitadel (coming soon)

# Version managed by Soverstack - only tested versions allowed
# Current: 25 | Supported: 25, 24, 23

# ------------------------------------------------------------------------------
# INSTANCES
# ------------------------------------------------------------------------------

instances:
  - name: keycloak-01
    vm_id: 200
    flavor: large
    image: debian-12
    host: ${primaryNodePrefix}-01
${!isLocal ? `
  - name: keycloak-02
    vm_id: 201
    flavor: large
    image: debian-12
    host: ${primaryNodePrefix}-02` : ""}

# ------------------------------------------------------------------------------
# CONFIGURATION OVERRIDES (optional)
# ------------------------------------------------------------------------------
# See: https://docs.soverstack.io/workloads/identity/keycloak

overwrite_config:
  # scheduling:
  #   strategy: auto                # manual (default) | auto
  #   host: ${primaryNodePrefix}-01
  #
  # networks:
  #   - vlan: management
  #
  # keycloak:
  #   http_relative_path: /auth
  #   proxy_mode: edge
  #   metrics_enabled: true
`;

  fs.writeFileSync(filePath, content.trim() + "\n");
}
