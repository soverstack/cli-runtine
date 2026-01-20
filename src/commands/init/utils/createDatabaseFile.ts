import { InitOptions } from "./index";
import fs from "fs";
import path from "path";

/**
 * Creates database.yaml with APPLICATION databases
 *
 * Structure: DatabasesLayer with array of DatabaseCluster
 * Multi-file merge: platform.yaml can reference "core-database.yaml, database.yaml"
 * The normalizer will merge the `databases` arrays from both files.
 */
export const createDatabaseFile = ({
  projectName,
  infrastructureTier,
  outputDir,
}: InitOptions): void => {
  const targetDir = outputDir || path.resolve(process.cwd(), projectName);
  const filePath = path.join(targetDir, "database.yaml");

  const isLocal = infrastructureTier === "local";
  const vmIds = isLocal ? "260" : "260, 261, 262";
  const haEnabled = !isLocal;

  const content = `# ============================================================
# APPLICATION DATABASE CLUSTERS
# ============================================================
#
# Add your application database clusters here.
# These will be merged with core-database.yaml (clusters are concatenated).
#
# Documentation: https://docs.soverstack.io/layers/database
#
# MULTI-FILE MERGE:
# In platform.yaml, use:
#   database: "core-database.yaml, database.yaml"
#
# The 'clusters' arrays from all files will be merged (concatenated).
#
# ============================================================

clusters:
  # ----------------------------------------------------------
  # EXAMPLE: APPLICATION DATABASE CLUSTER
  # ----------------------------------------------------------
  # Uncomment and modify this example for your application databases.
  # Each cluster can contain multiple databases.
  #
  # - name: app-cluster           # Unique cluster identifier
  #   type: postgresql
  #   version: "16"
  #
  #   cluster:
  #     name: apps                 # Patroni cluster name
  #     ha: ${haEnabled}
  #     vm_ids: [${vmIds}]         # Different VMs from core-infrastructure
  #
  #   port: 5432
  #   ssl: ${isLocal ? "preferred" : "required"}
  #
  #   databases:
  #     - name: myapp
  #       owner: myapp_user
  #
  #     - name: analytics
  #       owner: analytics_user
  #
  #     - name: notifications
  #       owner: notifications_user
  #
  #   credentials:
  #     type: env
  #     var_name: APP_POSTGRES_PASSWORD
  #
  #   backup:
  #     storage_backend: backup-main
  #     schedule: "0 3 * * *"
  #     retention:
  #       daily: 7
  #       weekly: 4
  #       monthly: 6
  #     type: pg_dumpall
`;

  fs.writeFileSync(filePath, content);
};
