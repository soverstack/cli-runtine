import { InitOptions, getPrimaryZone } from "./index";
import fs from "fs";
import path from "path";

/**
 * Creates the GLOBAL core-database.yaml file.
 *
 * Contains PostgreSQL cluster CONFIGURATION.
 * VMs are defined in core-compute.yaml (IAM_DATA group 200-299).
 *
 * This file only references vm_ids - actual VMs are in core-compute.yaml
 *
 * NOTE: Redis is NOT included by default.
 * Services use built-in alternatives:
 *   - Keycloak: Infinispan (embedded)
 *   - Grafana: PostgreSQL sessions
 *   - Headscale: works without cache
 */
export const createCoreDatabaseFile = (options: InitOptions): void => {
  const { projectName, infrastructureTier, outputDir } = options;
  const targetDir = outputDir || path.resolve(process.cwd(), projectName);
  const filePath = path.join(targetDir, "database.yaml");

  const isLocal = infrastructureTier === "local";
  const haEnabled = !isLocal;

  const content = `# ════════════════════════════════════════════════════════════════════════════
# GLOBAL DATABASE CONFIGURATION
# ════════════════════════════════════════════════════════════════════════════
#
# Database cluster configurations shared by ALL services.
#
# IMPORTANT: VMs are defined in core-compute.yaml (IAM_DATA group 200-299)
# This file only contains cluster configuration with vm_ids references.
#
# VM IDs used (from core-compute.yaml):
#   PostgreSQL: ${isLocal ? "250" : "250, 251, 252"}
#
# NOTE: Redis is NOT included by default. Services use built-in alternatives:
#   - Keycloak: Infinispan (embedded, no external cache needed)
#   - Grafana: PostgreSQL for sessions
#   - Headscale: works without external cache
#
# ════════════════════════════════════════════════════════════════════════════

clusters:

  # ═══════════════════════════════════════════════════════════════════════════
  # POSTGRESQL CLUSTER
  # ═══════════════════════════════════════════════════════════════════════════
  # Shared by all services - each service gets its own database
  #
  - name: main
    type: postgresql
    version: "16"

    cluster:
      name: main
      ha: ${haEnabled}
      vm_ids:
${isLocal ? `        - 250` : `        - 250
        - 251
        - 252`}

    port: 5432
    ssl: ${isLocal ? "preferred" : "required"}

    # Infrastructure databases (isolated per service)
    databases:
      - name: soverstack
        owner: soverstack
      - name: keycloak
        owner: keycloak
      - name: headscale
        owner: headscale
      - name: powerdns
        owner: powerdns
      - name: vault
        owner: vault
      - name: grafana
        owner: grafana


    credentials:
      type: env
      var_name: POSTGRES_ADMIN_PASSWORD

    pooler:
      enabled: true
      mode: transaction
      max_client_connections: 1000

    backup:
      enabled: true
      storage_backend: hub
      schedule: "0 */4 * * *"
      retention:
        daily: 7
        weekly: 4
        monthly: 6
      type: wal_archive
`;

  fs.writeFileSync(filePath, content);
};
