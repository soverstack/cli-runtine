import fs from "fs";
import path from "path";
import { ValidationResult, addError, addWarning } from "../utils/types";
import { SSHKeys, UserGroupType } from "../../../types";
import { validateSshUsername } from "../../init/utils/validateSSHName";
export const userGroups: UserGroupType[] = ["sudo", "docker", "kvm", "systemd-journal", "adm"];

/**
 * SSH Config file structure
 */
interface SSHConfig {
  users: SSHKeys[];
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
  const layer = "platform";
  const resolvedPath = path.resolve(platformDir, sshPath);

  // Check if SSH config file exists
  if (!fs.existsSync(resolvedPath)) {
    addError(
      result,
      layer,
      "ssh",
      `SSH configuration file not found: ${sshPath}`,
      "critical",
      `Create SSH configuration file at ${sshPath} with structure:
users:
  - user: root
    private_key_env_var: SSH_PRIVATE_KEY
    groups: sudo`
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
      "ssh",
      "SSH configuration must contain 'users' array",
      "critical",
      `Add users array to ${sshPath}:
users:
  - user: root
    private_key_env_var: SSH_PRIVATE_KEY
    groups: sudo`
    );
    return null;
  }

  if (sshConfig.users.length === 0) {
    addError(
      result,
      layer,
      "ssh.users",
      "SSH users array is empty - at least one user is required",
      "critical",
      "Add at least one SSH user to the users array"
    );
    return null;
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
  user: SSHKeys,
  index: number,
  result: ValidationResult,
  layer: string,
  platformDir: string,
  envVars: Map<string, string>
): void {
  const userField = `ssh.users[${index}]`;

  // Validate required fields
  if (!user.user) {
    addError(
      result,
      layer,
      `${userField}.user`,
      "SSH user name is required",
      "error",
      `Add 'user' field (e.g.,'soverstack_user', 'root', 'admin', 'deploy')`
    );
  }
  const userNameError = validateSshUsername(user.user);
  if (userNameError) {
    addError(
      result,
      layer,
      `${userField}.user`,
      "Security risk: This username is too predictable and susceptible to brute-force attacks.",
      "error",
      `${userNameError.error}`
    );
  }

  if (!user.groups) {
    addError(
      result,
      layer,
      `${userField}.groups`,
      "SSH user groups are required",
      "error",
      `Add 'groups' field: ${userGroups.toString()}`
    );
  } else if (!userGroups.includes(user.groups)) {
    addError(
      result,
      layer,
      `${userField}.groups`,
      `Invalid groups value: ${user.groups}`,
      "error",
      `Must be ${userGroups.toString()}`
    );
  }

  // Validate private key configuration (REQUIRED)
  const hasPrivateKeyPath = !!user.private_key_path;
  const hasPrivateKeyEnv = !!user.private_key_env_var;
  const hasPrivateKeyVault = !!user.private_key_vault_path;

  if (!hasPrivateKeyPath && !hasPrivateKeyEnv && !hasPrivateKeyVault) {
    addError(
      result,
      layer,
      `${userField}.private_key`,
      `User '${user.user}': Private key configuration is REQUIRED`,
      "critical",
      `Add one of:
- private_key_env_var: "SSH_PRIVATE_KEY_${user.user?.toUpperCase()}" (recommended)
- private_key_vault_path: "secret/ssh/${user.user}/private_key"
- private_key_path: "~/.ssh/id_rsa" (outside repo!)`
    );
  }

  // Validate private key path if provided
  if (hasPrivateKeyPath) {
    addWarning(
      result,
      layer,
      `${userField}.private_key_path`,
      `Using file path for private key - ensure it's OUTSIDE the repository`,
      "Consider using private_key_env_var or private_key_vault_path for better security"
    );

    validateSshKeyFile(
      user.private_key_path!,
      `${userField}.private_key_path`,
      platformDir,
      result,
      layer,
      true,
      envVars
    );
  }

  // Validate private key env var if provided
  if (hasPrivateKeyEnv) {
    validateEnvVar(
      user.private_key_env_var!,
      `${userField}.private_key_env_var`,
      envVars,
      result,
      layer,
      `SSH private key for user ${user.user}`
    );
  }

  // Validate private key vault path if provided
  if (hasPrivateKeyVault) {
    validateVaultPath(
      user.private_key_vault_path!,
      `${userField}.private_key_vault_path`,
      result,
      layer
    );
  }

  // Validate public key configuration (OPTIONAL but recommended)
  const hasPublicKeyPath = !!user.public_key_path;
  const hasPublicKeyEnv = !!user.public_key_env_var;
  const hasPublicKeyVault = !!user.public_key_vault_path;

  if (!hasPublicKeyPath && !hasPublicKeyEnv && !hasPublicKeyVault) {
    addWarning(
      result,
      layer,
      `${userField}.public_key`,
      `User '${user.user}': No public key configured`,
      "Consider adding public key for better security and authorized_keys management"
    );
  }

  // Validate public key path if provided
  if (hasPublicKeyPath) {
    validateSshKeyFile(
      user.public_key_path!,
      `${userField}.public_key_path`,
      platformDir,
      result,
      layer,
      false,
      envVars
    );
  }

  // Validate public key env var if provided
  if (hasPublicKeyEnv) {
    validateEnvVar(
      user.public_key_env_var!,
      `${userField}.public_key_env_var`,
      envVars,
      result,
      layer,
      `SSH public key for user ${user.user}`
    );
  }

  // Validate public key vault path if provided
  if (hasPublicKeyVault) {
    validateVaultPath(
      user.public_key_vault_path!,
      `${userField}.public_key_vault_path`,
      result,
      layer
    );
  }

  // Warn if multiple sources provided
  const privateKeySources = [hasPrivateKeyPath, hasPrivateKeyEnv, hasPrivateKeyVault].filter(
    Boolean
  ).length;
  if (privateKeySources > 1) {
    addWarning(
      result,
      layer,
      `${userField}.private_key`,
      `Multiple private key sources provided - env_var takes precedence over vault_path, vault_path over file_path`,
      "Remove extra configuration for clarity"
    );
  }
}

/**
 * Validates an SSH key file exists and has correct format
 */
function validateSshKeyFile(
  keyPath: string,
  fieldName: string,
  platformDir: string,
  result: ValidationResult,
  layer: string,
  isPrivate: boolean,
  envVars: Map<string, string>
): void {
  // Expand ~ and environment variables in path
  let expandedPath = keyPath;

  // Expand ~ to home directory
  if (expandedPath.startsWith("~")) {
    const homeDir = process.env.HOME || process.env.USERPROFILE;
    if (homeDir) {
      expandedPath = expandedPath.replace("~", homeDir);
    }
  }

  // Expand environment variables like $VAR or ${VAR}
  expandedPath = expandedPath.replace(/\$\{?(\w+)\}?/g, (match, varName) => {
    return envVars.get(varName) || process.env[varName] || match;
  });

  const resolvedPath = path.resolve(platformDir, expandedPath);

  // Check file exists
  if (!fs.existsSync(resolvedPath)) {
    addError(
      result,
      layer,
      fieldName,
      `SSH key file not found: ${keyPath}`,
      "critical",
      `Create SSH key file at ${keyPath} or use environment variable instead`
    );
    return;
  }

  // Read and validate key format
  try {
    const content = fs.readFileSync(resolvedPath, "utf8");

    if (isPrivate) {
      // Validate private key format
      const validPrivateKeyHeaders = [
        "-----BEGIN RSA PRIVATE KEY-----",
        "-----BEGIN PRIVATE KEY-----",
        "-----BEGIN EC PRIVATE KEY-----",
        "-----BEGIN OPENSSH PRIVATE KEY-----",
        "-----BEGIN DSA PRIVATE KEY-----",
      ];

      const hasValidHeader = validPrivateKeyHeaders.some((header) => content.includes(header));

      if (!hasValidHeader) {
        addError(
          result,
          layer,
          fieldName,
          `Invalid private key format in ${keyPath}`,
          "error",
          "File must be a valid SSH private key (RSA, EC, OPENSSH, or DSA format)"
        );
      }

      // Check permissions on Unix-like systems (skip on Windows)
      if (process.platform !== "win32") {
        const stats = fs.statSync(resolvedPath);
        const mode = stats.mode & 0o777;

        if (mode !== 0o600 && mode !== 0o400) {
          addWarning(
            result,
            layer,
            fieldName,
            `Private key has insecure permissions: ${mode.toString(8)}`,
            `Run: chmod 600 ${keyPath}`
          );
        }
      }
    } else {
      // Validate public key format
      const validPublicKeyPrefixes = [
        "ssh-rsa",
        "ssh-ed25519",
        "ecdsa-sha2-nistp256",
        "ecdsa-sha2-nistp384",
        "ecdsa-sha2-nistp521",
        "ssh-dss",
      ];

      const hasValidPrefix = validPublicKeyPrefixes.some((prefix) =>
        content.trim().startsWith(prefix)
      );

      if (!hasValidPrefix) {
        addError(
          result,
          layer,
          fieldName,
          `Invalid public key format in ${keyPath}`,
          "error",
          "File must be a valid SSH public key (starts with ssh-rsa, ssh-ed25519, etc.)"
        );
      }
    }
  } catch (error) {
    addError(
      result,
      layer,
      fieldName,
      `Failed to read SSH key file ${keyPath}: ${(error as Error).message}`,
      "error"
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
    addError(
      result,
      layer,
      fieldName,
      `Environment variable ${envVarName} is not defined`,
      "critical",
      `Add ${envVarName}="${description}" to your .env file`
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

/**
 * Validates vault path format
 */
function validateVaultPath(
  vaultPath: string,
  fieldName: string,
  result: ValidationResult,
  layer: string
): void {
  if (!vaultPath.startsWith("secret/")) {
    addWarning(
      result,
      layer,
      fieldName,
      `Vault path should typically start with 'secret/'`,
      `Ensure vault path is correct: ${vaultPath}`
    );
  }

  // Validate path structure
  const parts = vaultPath.split("/");
  if (parts.length < 2) {
    addError(
      result,
      layer,
      fieldName,
      `Invalid vault path: ${vaultPath}`,
      "error",
      "Vault path should be in format: secret/data/path/to/secret"
    );
  }
}
