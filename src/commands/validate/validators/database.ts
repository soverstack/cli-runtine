import { DatabasesLayer, DatabaseCluster, InfrastructureTierType } from "../../../types";
import { ValidationResult, ValidationContext, addError, addWarning } from "../utils/types";
import { INFRASTRUCTURE_REQUIREMENTS } from "../../../infrastructure-requirements";

/**
 * Validates databases layer configuration
 *
 * VALIDATION RULES:
 * - Each cluster must have a unique name
 * - HA requires minimum 3 VM IDs for Patroni quorum
 * - Mandatory databases must exist for core services (keycloak, headscale, powerdns, openbao)
 * - SSL should be required for production/enterprise
 */
export function validateDatabases(
  databasesLayer: DatabasesLayer,
  context: ValidationContext,
  result: ValidationResult,
  infrastructureTier: InfrastructureTierType
): void {
  const layer = "database";

  if (!databasesLayer.clusters || databasesLayer.clusters.length === 0) {
    if (infrastructureTier !== "local") {
      addError(
        result,
        layer,
        "clusters",
        `At least one database cluster is required for ${infrastructureTier} tier`,
        "critical",
        "Add a database cluster with PostgreSQL configuration"
      );
    }
    return;
  }

  const clusterNames = new Set<string>();

  // Validate each database cluster
  databasesLayer.clusters.forEach((cluster, index) => {
    validateDatabaseCluster(cluster, index, clusterNames, context, result, layer, infrastructureTier);
  });

  // Validate mandatory databases exist (for production/enterprise)
  if (infrastructureTier !== "local") {
    validateMandatoryDatabases(databasesLayer, result, layer, infrastructureTier);
  }
}

/**
 * Validates a single database cluster
 */
function validateDatabaseCluster(
  cluster: DatabaseCluster,
  index: number,
  clusterNames: Set<string>,
  context: ValidationContext,
  result: ValidationResult,
  layer: string,
  tier: InfrastructureTierType
): void {
  const clusterField = `databases[${index}]`;

  // Validate cluster name (top-level identifier)
  if (!cluster.name) {
    addError(
      result,
      layer,
      `${clusterField}.name`,
      "Cluster name is required",
      "critical",
      "Add a unique name for this database cluster (e.g., 'main-cluster')"
    );
  } else {
    // Check for duplicate cluster names
    if (clusterNames.has(cluster.name)) {
      addError(
        result,
        layer,
        `${clusterField}.name`,
        `Duplicate cluster name: ${cluster.name}`,
        "critical",
        "Each database cluster must have a unique name"
      );
    } else {
      clusterNames.add(cluster.name);
    }
  }

  // Validate type
  if (cluster.type !== "postgresql") {
    addError(
      result,
      layer,
      `${clusterField}.type`,
      `Only 'postgresql' type is supported, got '${cluster.type}'`,
      "error"
    );
  }

  // Validate version
  if (!cluster.version) {
    addError(
      result,
      layer,
      `${clusterField}.version`,
      "PostgreSQL version is required",
      "error",
      "Specify version: '14', '15', or '16'"
    );
  }

  // Validate cluster config
  if (!cluster.cluster) {
    addError(
      result,
      layer,
      `${clusterField}.cluster`,
      "Cluster configuration is required",
      "critical"
    );
    return;
  }

  // Validate Patroni cluster name
  if (!cluster.cluster.name) {
    addError(
      result,
      layer,
      `${clusterField}.cluster.name`,
      "Patroni cluster name is required",
      "error",
      "Add a name for the Patroni cluster (e.g., 'main')"
    );
  }

  // Validate VM IDs
  if (!cluster.cluster.vm_ids || cluster.cluster.vm_ids.length === 0) {
    addError(
      result,
      layer,
      `${clusterField}.cluster.vm_ids`,
      "At least one VM ID is required for the database cluster",
      "critical"
    );
  } else {
    // HA validation
    if (cluster.cluster.ha) {
      if (cluster.cluster.vm_ids.length < 3) {
        if (tier === "local") {
          addWarning(
            result,
            layer,
            `${clusterField}.cluster.vm_ids`,
            `HA cluster requires at least 3 VMs for Patroni quorum, found ${cluster.cluster.vm_ids.length}`,
            "Add more VMs for proper HA or disable HA for local development"
          );
        } else {
          addError(
            result,
            layer,
            `${clusterField}.cluster.vm_ids`,
            `HA cluster requires at least 3 VMs for Patroni quorum, found ${cluster.cluster.vm_ids.length}`,
            "critical",
            "Add more VMs or set ha: false"
          );
        }
      }

      // Odd number recommended for quorum
      if (cluster.cluster.vm_ids.length % 2 === 0) {
        addWarning(
          result,
          layer,
          `${clusterField}.cluster.vm_ids`,
          `Odd number of VMs recommended for quorum (found ${cluster.cluster.vm_ids.length})`,
          "Consider using 3 or 5 VMs for proper quorum voting"
        );
      }
    }

    // Validate VM IDs are in correct range
    cluster.cluster.vm_ids.forEach((vmId, vmIndex) => {
      if (vmId < 250 || vmId > 279) {
        addWarning(
          result,
          layer,
          `${clusterField}.cluster.vm_ids[${vmIndex}]`,
          `VM ID ${vmId} is outside the DATABASE range (250-279)`,
          "Consider using VM IDs in the reserved database range"
        );
      }
    });
  }

  // Validate SSL for production
  if (tier !== "local" && cluster.ssl !== "required") {
    addWarning(
      result,
      layer,
      `${clusterField}.ssl`,
      `SSL should be 'required' for ${tier} tier, got '${cluster.ssl}'`,
      "Set ssl: 'required' for secure database connections"
    );
  }

  // Validate credentials
  if (!cluster.credentials) {
    addError(
      result,
      layer,
      `${clusterField}.credentials`,
      "Database credentials are required",
      "critical",
      "Add credentials with type: vault, env, or file"
    );
  }

  // Validate internal databases
  if (!cluster.databases || cluster.databases.length === 0) {
    addWarning(
      result,
      layer,
      `${clusterField}.databases`,
      "No databases defined in this cluster",
      "Add database definitions with name and owner"
    );
  } else {
    const dbNames = new Set<string>();
    cluster.databases.forEach((db, dbIndex) => {
      if (!db.name) {
        addError(
          result,
          layer,
          `${clusterField}.databases[${dbIndex}].name`,
          "Database name is required",
          "error"
        );
      } else if (dbNames.has(db.name)) {
        addError(
          result,
          layer,
          `${clusterField}.databases[${dbIndex}].name`,
          `Duplicate database name: ${db.name}`,
          "error"
        );
      } else {
        dbNames.add(db.name);
      }

      if (!db.owner) {
        addError(
          result,
          layer,
          `${clusterField}.databases[${dbIndex}].owner`,
          "Database owner is required",
          "error"
        );
      }
    });
  }
}

/**
 * Validates that mandatory databases are configured
 */
function validateMandatoryDatabases(
  databasesLayer: DatabasesLayer,
  result: ValidationResult,
  layer: string,
  tier: InfrastructureTierType
): void {
  const mandatoryDbs = INFRASTRUCTURE_REQUIREMENTS.mandatory_databases;

  // Collect all database names across all clusters
  const allDbNames = new Set<string>();
  databasesLayer.clusters.forEach((cluster) => {
    cluster.databases?.forEach((db) => {
      allDbNames.add(db.name);
    });
  });

  // Check each mandatory database
  mandatoryDbs.forEach((mandatoryDb) => {
    if (!allDbNames.has(mandatoryDb.name)) {
      addError(
        result,
        layer,
        `mandatory_databases.${mandatoryDb.name}`,
        `Mandatory database '${mandatoryDb.name}' is missing (required for ${mandatoryDb.purpose})`,
        tier === "enterprise" ? "critical" : "error",
        `Add database: { name: "${mandatoryDb.name}", owner: "${mandatoryDb.owner}" } to a cluster`
      );
    }
  });
}
