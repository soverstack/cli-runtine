import { Datacenter, InfrastructureTierType } from "../../../types";
import { ValidationResult, ValidationContext, addError, addWarning } from "../utils/types";
import {
  validateMinimumNodes,
  validateOddNodeCount,
} from "../rules/ha-requirements";
import {
  validateCredentialRef,
  validateIpFormat,
} from "../rules/security";

/**
 * Validates datacenter configuration
 * 
 * Current Datacenter type only has:
 * - name: string
 * - servers: array of server configs with CredentialRef for password
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

    // Security: validate password using CredentialRef
    validateCredentialRef(
      server.password,
      `${serverField}.password`,
      result,
      layer,
      true
    );

    // Disk encryption password validation
    if (server.disk_encryption?.enabled) {
      validateCredentialRef(
        server.disk_encryption.password,
        `${serverField}.disk_encryption.password`,
        result,
        layer,
        true
      );
    }
  });
}
