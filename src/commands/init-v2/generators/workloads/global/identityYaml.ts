/**
 * Generate workloads/global/identity.yaml
 */

import fs from "fs";
import path from "path";
import { GeneratorContext, versionLine, vmId } from "../../../types";

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
${versionLine("keycloak")}
    instances:
      - name: identity-01
        vm_id: ${vmId("global", 0, 0, "identity", 0)}
        flavor: large
        image: debian-12
        host: ${primaryNodePrefix}-01
${!isLocal ? `
      - name: identity-02
        vm_id: ${vmId("global", 0, 0, "identity", 1)}
        flavor: large
        image: debian-12
        host: ${primaryNodePrefix}-02` : ""}
    overwrite_config:
      # http_relative_path: /auth
      # proxy_mode: edge
      # metrics_enabled: true
`;

  fs.writeFileSync(filePath, content.trim() + "\n");
}
