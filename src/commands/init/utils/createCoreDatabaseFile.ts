import { InitOptions } from "./index";
import fs from "fs";
import path from "path";

/**
 * Creates core-database.yaml with the PostgreSQL cluster definition
 * and infrastructure databases (keycloak, headscale, etc.)
 *
 * Structure: DatabasesLayer with one DatabaseCluster
 */
export const createCoreDatabaseFile = ({
  projectName,
  infrastructureTier,
  outputDir,
}: InitOptions): void => {
  const targetDir = outputDir || path.resolve(process.cwd(), projectName);
  const filePath = path.join(targetDir, "core-database.yaml");

  const isLocal = infrastructureTier === "local";
  const vmIds = isLocal ? "250" : "250, 251, 252";
  const haEnabled = !isLocal;

  const content = `# ============================================================
# CORE DATABASE - PostgreSQL Cluster + Infrastructure Databases
# ============================================================
#
# This file defines the main PostgreSQL cluster and infrastructure databases.
# Application clusters can be added in database.yaml (clusters are merged).
#
# Documentation: https://docs.soverstack.io/layers/database
#
# MULTI-FILE MERGE:
# In platform.yaml:
#   database: "core-database.yaml, database.yaml"
#
# The 'clusters' arrays from all files will be merged (concatenated).
#
# ============================================================

clusters:
  # ----------------------------------------------------------
  # CORE INFRASTRUCTURE CLUSTER
  # ----------------------------------------------------------
  # Main PostgreSQL cluster for infrastructure services.
  #
  # REQUIREMENTS FOR ${isLocal ? "LOCAL" : "PRODUCTION/ENTERPRISE"}:
  # - Minimum ${isLocal ? "1" : "3"} VM(s) ${isLocal ? "" : "for HA (odd number for Patroni quorum)"}
  # - VMs defined in core-compute.yaml (vm_ids: 250-279)
  # - SSL enforced for production
  #
  - name: core-infrastructure   # Unique cluster identifier
    type: postgresql
    version: "16"               # Supported: 14, 15, 16

    cluster:
      name: main                # Patroni cluster name
      ha: ${haEnabled}
      vm_ids: [${vmIds}]        # References core-compute.yaml
      # read_replicas_vm_ids: [] # Optional: for read scaling

    port: 5432
    ssl: ${isLocal ? "preferred" : "required"}  # required | preferred | disabled

    # Infrastructure databases (required by Soverstack core services)
    databases:
      # Soverstack - Runtime state and configuration
      - name: soverstack
        owner: soverstack

      # Keycloak - Identity and Access Management
      - name: keycloak
        owner: keycloak

      # Headscale - VPN coordination server
      - name: headscale
        owner: headscale

      # PowerDNS - Authoritative DNS server
      - name: powerdns
        owner: powerdns

      # OpenBao/Vault - Secrets management audit logs
      - name: openbao
        owner: openbao

      # Grafana - Dashboards and alerting
      - name: grafana
        owner: grafana

    # Credentials - NEVER store in plain text!
    credentials:
      type: env
      var_name: POSTGRES_PASSWORD
      # Alternative: Vault (recommended for production)
      # type: vault
      # path: secret/data/database/postgres

    # Backup configuration
    backup:
      storage_backend: backup-main  # Reference to storage_backends in datacenter.yaml
      schedule: "0 2 * * *"         # Cron: Daily at 2 AM
      retention:
        daily: 7
        weekly: 4
        monthly: 12
      type: pg_dumpall              # pg_dumpall | wal_archive (for PITR)
`;

  fs.writeFileSync(filePath, content);
};
