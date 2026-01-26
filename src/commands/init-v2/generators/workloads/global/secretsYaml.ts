/**
 * Generate workloads/global/secrets.yaml - Vault
 */

import fs from "fs";
import path from "path";
import { GeneratorContext } from "../../../types";

export function generateSecretsYaml(ctx: GeneratorContext): void {
  const { projectPath, options } = ctx;
  const globalDir = path.join(projectPath, "workloads", "global");
  const filePath = path.join(globalDir, "secrets.yaml");

  fs.mkdirSync(globalDir, { recursive: true });

  const primaryNodePrefix = `pve-${options.primaryRegion}-${options.primaryZone}`;
  const isLocal = options.infrastructureTier === "local";

  const content = `# ==============================================================================
# SECRETS - GLOBAL
# ==============================================================================
#
# Secrets management and encryption for the platform.
#
# ==============================================================================

services:
  # ============================================================================
  # SECRETS
  # ============================================================================
  - role: secrets
    scope: global
    implementation: vault         # vault | infisical
    # Version: 1.17 | Supported: 1.17, 1.16, 1.15
    instances:
      - name: vault-01
        vm_id: 150
        flavor: standard
        image: debian-12
        host: ${primaryNodePrefix}-01
${!isLocal ? `
      - name: vault-02
        vm_id: 151
        flavor: standard
        image: debian-12
        host: ${primaryNodePrefix}-02` : ""}
    overwrite_config:
      # ui: true
      # log_level: info
      # max_lease_ttl: 768h

# ------------------------------------------------------------------------------
# GLOBAL OVERRIDES (optional)
# ------------------------------------------------------------------------------
# See: https://docs.soverstack.io/workloads/secrets

overwrite_config:
  # scheduling:
  #   strategy: auto                # manual (default) | auto
  #
  # networks:
  #   - vlan: management
`;

  fs.writeFileSync(filePath, content.trim() + "\n");
}
