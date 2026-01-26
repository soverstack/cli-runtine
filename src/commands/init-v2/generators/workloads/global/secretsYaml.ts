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
# SECRETS SERVICE
# ==============================================================================
#
# Secrets management and encryption.
# Location: ${options.primaryRegion}/zone-${options.primaryZone}
#
# ==============================================================================

scope: global

# ------------------------------------------------------------------------------
# SERVICE DEFINITION
# ------------------------------------------------------------------------------

role: secrets                     # What this service provides
implementation: vault             # vault | infisical (coming soon)

# Version managed by Soverstack - only tested versions allowed
# Current: 1.17 | Supported: 1.17, 1.16, 1.15

# ------------------------------------------------------------------------------
# INSTANCES
# ------------------------------------------------------------------------------

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

# ------------------------------------------------------------------------------
# CONFIGURATION OVERRIDES (optional)
# ------------------------------------------------------------------------------
# See: https://docs.soverstack.io/workloads/secrets/vault

overwrite_config:
  # scheduling:
  #   strategy: auto                # manual (default) | auto
  #   host: ${primaryNodePrefix}-01
  #
  # networks:
  #   - vlan: management
  #
  # vault:
  #   ui: true
  #   log_level: info
  #   max_lease_ttl: 768h
`;

  fs.writeFileSync(filePath, content.trim() + "\n");
}
