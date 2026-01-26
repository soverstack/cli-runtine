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
# IDENTITY - GLOBAL
# ==============================================================================
#
# Identity management and SSO for the platform.
#
# ==============================================================================

services:
  # ============================================================================
  # IDENTITY
  # ============================================================================
  - role: identity
    scope: global
    implementation: keycloak      # keycloak | authentik | zitadel
    # Version: 25 | Supported: 25, 24, 23
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
    overwrite_config:
      # http_relative_path: /auth
      # proxy_mode: edge
      # metrics_enabled: true

# ------------------------------------------------------------------------------
# GLOBAL OVERRIDES (optional)
# ------------------------------------------------------------------------------
# See: https://docs.soverstack.io/workloads/identity

overwrite_config:
  # scheduling:
  #   strategy: auto                # manual (default) | auto
  #
  # networks:
  #   - vlan: management
`;

  fs.writeFileSync(filePath, content.trim() + "\n");
}
