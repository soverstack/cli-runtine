import fs from "fs";
import path from "path";
import { ValidationResult, addError, addWarning } from "../utils/types";
import { SSHUser, UserGroupType, CredentialRef } from "../../../types";
import { validateSshUsername } from "../../init/utils/validateSSHName";
import { validateCredentialRef } from "./security";

export const validUserGroups: UserGroupType[] = ["sudo", "docker", "kvm", "systemd-journal", "adm"];

/**
 * SSH Config file structure
 */
interface SSHConfig {
  users: SSHUser[];
  rotation_policy?: {
    max_age_days: number;
    warning_days: number;
  };
  knockd?: {
    enabled: boolean;
    sequence: number[];
  };
}

/**
 * Validates SSH configuration file exists and has correct structure
 */
export function validateSshConfig(
  sshPath: string,
  platformDir: string,
  result: ValidationResult,
  envVars: Map<string, string>
): SSHConfig | null {
  const layer = "ssh";
  const resolvedPath = path.resolve(platformDir, sshPath);

  // Check if SSH config file exists
  if (!fs.existsSync(resolvedPath)) {
    addError(
      result,
      layer,
      "ssh",
      `SSH configuration file not found: ${sshPath}`,
      "critical",
      "Create SSH configuration file with users array containing CredentialRef for keys"
    );
    return null;
  }

  // Load and parse SSH config
  let sshConfig: SSHConfig;
  try {
    const content = fs.readFileSync(resolvedPath, "utf8");
    const yaml = require("js-yaml");
    const parsed = yaml.load(content);

    if (!parsed || typeof parsed !== "object") {
      throw new Error("Invalid YAML structure");
    }

    sshConfig = parsed as SSHConfig;
  } catch (error) {
    addError(
      result,
      layer,
      "ssh",
      `Failed to parse SSH configuration file: ${(error as Error).message}`,
      "critical",
      "Ensure the SSH config is valid YAML"
    );
    return null;
  }

  // Validate users array
  if (!sshConfig.users || !Array.isArray(sshConfig.users)) {
    addError(
      result,
      layer,
      "users",
      "SSH configuration must contain 'users' array",
      "critical",
      "Add users array with SSH key configuration"
    );
    return null;
  }

  if (sshConfig.users.length === 0) {
    addError(
      result,
      layer,
      "users",
      "SSH users array is empty - at least one user is required",
      "critical",
      "Add at least one SSH user to the users array"
    );
    return null;
  }

  // Require minimum 2 sudo users for redundancy
  const sudoUsers = sshConfig.users.filter(
    (u) => u.groups && Array.isArray(u.groups) && u.groups.includes("sudo")
  );
  if (sudoUsers.length < 2) {
    addWarning(
      result,
      layer,
      "users",
      `Only ${sudoUsers.length} sudo user(s) configured - recommend at least 2 for redundancy`,
      "Add a backup administrator with sudo access"
    );
  }

  // Validate each user
  sshConfig.users.forEach((user, index) => {
    validateSshUser(user, index, result, layer, platformDir, envVars);
  });

  return sshConfig;
}

/**
 * Validates a single SSH user configuration
 */
function validateSshUser(
  user: SSHUser,
  index: number,
  result: ValidationResult,
  layer: string,
  platformDir: string,
  envVars: Map<string, string>
): void {
  const userField = `users[${index}]`;

  // Validate required fields
  if (!user.name) {
    addError(
      result,
      layer,
      `${userField}.name`,
      "SSH user name is required",
      "error",
      "Add 'name' field (e.g., 'soverstack_admin', 'deploy')"
    );
  } else {
    const userNameError = validateSshUsername(user.name);
    if (userNameError) {
      addError(
        result,
        layer,
        `${userField}.name`,
        "Security risk: Username is too predictable and susceptible to brute-force attacks",
        "error",
        userNameError.error
      );
    }
  }

  // Validate groups
  if (!user.groups) {
    addError(
      result,
      layer,
      `${userField}.groups`,
      "SSH user groups are required",
      "error",
      `Add 'groups' field: ${validUserGroups.join(", ")}`
    );
  } else {
    // groups can be a single string or array
    const userGroupsArray = Array.isArray(user.groups) ? user.groups : [user.groups];
    const invalidGroups = userGroupsArray.filter(
      (g) => !validUserGroups.includes(g as UserGroupType)
    );

    if (invalidGroups.length > 0) {
      addError(
        result,
        layer,
        `${userField}.groups`,
        `Invalid group(s): ${invalidGroups.join(", ")}`,
        "error",
        `Valid groups: ${validUserGroups.join(", ")}`
      );
    }
  }

  // Validate private key using CredentialRef (REQUIRED)
  validateCredentialRef(user.private_key, `${userField}.private_key`, result, layer, true);

  // Validate public key using CredentialRef (REQUIRED)
  validateCredentialRef(user.public_key, `${userField}.public_key`, result, layer, true);

  // Validate env vars if using env type
  if (user.private_key?.type === "env" && user.private_key.var_name) {
    validateEnvVar(
      user.private_key.var_name,
      `${userField}.private_key.var_name`,
      envVars,
      result,
      layer,
      `SSH private key for user ${user.name}`
    );
  }

  if (user.public_key?.type === "env" && user.public_key.var_name) {
    validateEnvVar(
      user.public_key.var_name,
      `${userField}.public_key.var_name`,
      envVars,
      result,
      layer,
      `SSH public key for user ${user.name}`
    );
  }
}

/**
 * Validates an environment variable is defined
 */
function validateEnvVar(
  envVarName: string,
  fieldName: string,
  envVars: Map<string, string>,
  result: ValidationResult,
  layer: string,
  description: string
): void {
  if (!envVars.has(envVarName)) {
    addWarning(
      result,
      layer,
      fieldName,
      `Environment variable ${envVarName} is not defined`,
      `Add ${envVarName} to your .env file (${description})`
    );
    return;
  }

  const value = envVars.get(envVarName);
  if (!value || value.trim() === "") {
    addWarning(
      result,
      layer,
      fieldName,
      `Environment variable ${envVarName} is empty`,
      `Set a value for ${envVarName} in your .env file`
    );
  }
}
