import { Datacenter, InfrastructureTierType } from "../../../types";
import { ValidationResult, ValidationContext, addError, addWarning } from "../utils/types";
import {
  validateMinimumNodes,
  validateOddNodeCount,
  validateFailoverNetwork,
  validateCephRequirements,
} from "../rules/ha-requirements";
import {
  validateNoPlainTextPassword,
  validateCidrFormat,
  validateIpFormat,
} from "../rules/security";
import { validateEnvVariable } from "../rules/path-validation";

/**
 * Validates datacenter configuration
 */
export function validateDatacenter(
  datacenter: Datacenter,
  context: ValidationContext,
  result: ValidationResult,
  infrastructureTier: InfrastructureTierType,
  envVars?: Map<string, string>
): void {
  const layer = "datacenter";

  // Validate name
  if (!datacenter.name) {
    addError(result, layer, "name", "Datacenter name is required", "error");
  }

  // Validate servers
  if (!datacenter.servers || datacenter.servers.length === 0) {
    addError(
      result,
      layer,
      "servers",
      "At least one server is required",
      "critical",
      "Add server configurations to the servers array"
    );
    return; // Can't continue without servers
  }

  // HA Requirements: minimum 3 servers for quorum
  validateMinimumNodes(datacenter.servers, 3, "Proxmox cluster", result, layer, "servers", infrastructureTier);

  // Warn if even number of servers
  validateOddNodeCount(datacenter.servers.length, "Proxmox cluster", result, layer, "servers", infrastructureTier);

  // Validate each server
  datacenter.servers.forEach((server, index) => {
    const serverField = `servers[${index}]`;

    // Required fields
    if (!server.name) {
      addError(result, layer, `${serverField}.name`, "Server name is required", "error");
    } else {
      // Check for duplicate names
      if (context.server_names.has(server.name)) {
        addError(
          result,
          layer,
          `${serverField}.name`,
          `Duplicate server name: ${server.name}`,
          "critical",
          "Each server must have a unique name"
        );
      } else {
        context.server_names.add(server.name);
      }
    }

    if (!server.ip) {
      addError(result, layer, `${serverField}.ip`, "Server IP is required", "error");
    } else {
      validateIpFormat(server.ip, `${serverField}.ip`, result, layer);
    }

    if (!server.os) {
      addError(result, layer, `${serverField}.os`, "Server OS is required", "error");
    }

    // Security: validate password configuration
    validateNoPlainTextPassword(
      server.root_password,
      server.root_password_env_var,
      server.root_password_vault_path,
      `${serverField}.root_password`,
      result,
      layer
    );

    // Validate env var if specified
    if (server.root_password_env_var && envVars) {
      validateEnvVariable(
        server.root_password_env_var,
        `${serverField}.root_password_env_var`,
        envVars,
        result,
        layer,
        "root password",
        true
      );
    }

    // Disk encryption
    if (server.disk_encryption?.enabled) {
      validateNoPlainTextPassword(
        server.disk_encryption.pass_key,
        server.disk_encryption.pass_key_env_var,
        server.disk_encryption.pass_key_vault_path,
        `${serverField}.disk_encryption.pass_key`,
        result,
        layer
      );

      // Validate env var if specified
      if (server.disk_encryption.pass_key_env_var && envVars) {
        validateEnvVariable(
          server.disk_encryption.pass_key_env_var,
          `${serverField}.disk_encryption.pass_key_env_var`,
          envVars,
          result,
          layer,
          "disk encryption passkey",
          true
        );
      }
    }
  });

  // Validate network
  if (!datacenter.network) {
    addError(result, layer, "network", "Network configuration is required", "critical");
  } else {
    if (!datacenter.network.type) {
      addError(result, layer, "network.type", "Network type is required", "error");
    }

    // Validate failover subnet if HA
    const hasHA = datacenter.servers.length >= 3;
    validateFailoverNetwork(datacenter.network.failover_subnet, hasHA, result, layer, infrastructureTier);

    if (datacenter.network.failover_subnet) {
      validateCidrFormat(
        datacenter.network.failover_subnet,
        "network.failover_subnet",
        result,
        layer
      );
    }
  }

  // Validate Ceph configuration
  if (datacenter.ceph) {
    const cephEnabled = datacenter.ceph.enabled ?? false;

    if (cephEnabled) {
      // Validate minimum servers
      validateCephRequirements(cephEnabled, datacenter.ceph.servers || [], result, layer, infrastructureTier);

      // Validate server names exist
      datacenter.ceph.servers?.forEach((serverName, index) => {
        if (!context.server_names.has(serverName)) {
          addError(
            result,
            layer,
            `ceph.servers[${index}]`,
            `Server "${serverName}" not found in datacenter servers`,
            "error",
            `Available servers: ${Array.from(context.server_names).join(", ")}`
          );
        }
      });

      // Validate networks
      if (datacenter.ceph.private_network) {
        validateCidrFormat(datacenter.ceph.private_network, "ceph.private_network", result, layer);
      } else {
        addWarning(
          result,
          layer,
          "ceph.private_network",
          "Ceph private network not configured - may impact performance",
          "Configure a dedicated private network (e.g., '10.0.1.0/24') for Ceph traffic"
        );
      }

      if (datacenter.ceph.public_network) {
        validateCidrFormat(datacenter.ceph.public_network, "ceph.public_network", result, layer);
      }
    }
  }

  // Validate cluster configuration
  if (datacenter.cluster) {
    if (datacenter.cluster.private_network) {
      validateCidrFormat(
        datacenter.cluster.private_network,
        "cluster.private_network",
        result,
        layer
      );
    }

    if (datacenter.cluster.public_network) {
      validateCidrFormat(
        datacenter.cluster.public_network,
        "cluster.public_network",
        result,
        layer
      );
    }
  }

  // Validate alert configuration
  if (!datacenter.alert || !datacenter.alert.admin_email) {
    addError(
      result,
      layer,
      "alert.admin_email",
      "Admin email is required for alerting",
      "error",
      "Add an admin email address to receive critical alerts"
    );
  } else {
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(datacenter.alert.admin_email)) {
      addError(
        result,
        layer,
        "alert.admin_email",
        `Invalid email format: ${datacenter.alert.admin_email}`,
        "error"
      );
    }
  }
}
