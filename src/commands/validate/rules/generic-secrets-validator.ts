import fs from "fs";
import path from "path";
import { ValidationResult, addError, addWarning } from "../utils/types";

/**
 * Generic validator for all secrets across configuration
 * Validates all *_env_var, *_vault_path, and *_path fields
 */
export function validateAllSecrets(
  config: any,
  layer: string,
  basePath: string,
  platformDir: string,
  envVars: Map<string, string>,
  result: ValidationResult
): void {
  validateSecretsRecursive(config, layer, basePath, platformDir, envVars, result);
}

/**
 * Recursively validates secrets in configuration objects
 */
function validateSecretsRecursive(
  obj: any,
  layer: string,
  fieldPath: string,
  platformDir: string,
  envVars: Map<string, string>,
  result: ValidationResult
): void {
  if (!obj || typeof obj !== "object") {
    return;
  }

  // Handle arrays
  if (Array.isArray(obj)) {
    obj.forEach((item, index) => {
      validateSecretsRecursive(
        item,
        layer,
        `${fieldPath}[${index}]`,
        platformDir,
        envVars,
        result
      );
    });
    return;
  }

  // Handle objects
  Object.entries(obj).forEach(([key, value]) => {
    const currentPath = fieldPath ? `${fieldPath}.${key}` : key;

    // Validate environment variables
    if (key.endsWith("_env_var") && typeof value === "string") {
      validateEnvVar(
        value,
        currentPath,
        layer,
        envVars,
        result,
        getSecretDescription(key)
      );
    }

    // Validate vault paths
    else if (key.endsWith("_vault_path") && typeof value === "string") {
      validateVaultPath(value, currentPath, layer, result);
    }

    // Validate file paths (for secrets/keys/credentials)
    else if (isSecretPath(key) && typeof value === "string") {
      validateSecretFilePath(value, currentPath, layer, platformDir, envVars, result);
    }

    // Recurse into nested objects
    else if (value && typeof value === "object") {
      validateSecretsRecursive(value, layer, currentPath, platformDir, envVars, result);
    }
  });
}

/**
 * Checks if a key represents a path to a secret file
 */
function isSecretPath(key: string): boolean {
  const secretPathKeys = [
    "private_key_path",
    "public_key_path",
    "key_path",
    "certificate_path",
    "cert_path",
    "credentials_path",
    "file_path", // For credentials
    "sops_key_path",
  ];

  return secretPathKeys.some((pattern) => key.includes(pattern));
}

/**
 * Gets a human-readable description for a secret
 */
function getSecretDescription(envVarKey: string): string {
  const keyLower = envVarKey.toLowerCase();

  if (keyLower.includes("password")) return "password";
  if (keyLower.includes("private_key")) return "private SSH key";
  if (keyLower.includes("public_key")) return "public SSH key";
  if (keyLower.includes("access_key")) return "access key";
  if (keyLower.includes("secret_key")) return "secret key";
  if (keyLower.includes("pass_key")) return "encryption passkey";
  if (keyLower.includes("token")) return "authentication token";
  if (keyLower.includes("api_key")) return "API key";

  return "secret value";
}

/**
 * Validates an environment variable exists and is not empty
 */
function validateEnvVar(
  envVarName: string,
  fieldPath: string,
  layer: string,
  envVars: Map<string, string>,
  result: ValidationResult,
  description: string
): void {
  if (!envVars.has(envVarName)) {
    addError(
      result,
      layer,
      fieldPath,
      `Environment variable ${envVarName} is not defined`,
      "critical",
      `Add ${envVarName}="${description}" to your .env or .env.{environment} file`
    );
    return;
  }

  const value = envVars.get(envVarName);
  if (!value || value.trim() === "") {
    addWarning(
      result,
      layer,
      fieldPath,
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
  fieldPath: string,
  layer: string,
  result: ValidationResult
): void {
  // Basic format validation
  if (!vaultPath || vaultPath.trim() === "") {
    addError(
      result,
      layer,
      fieldPath,
      "Vault path is empty",
      "error",
      "Provide a valid vault path (e.g., secret/data/path/to/secret)"
    );
    return;
  }

  // Validate path structure
  const parts = vaultPath.split("/");
  if (parts.length < 2) {
    addError(
      result,
      layer,
      fieldPath,
      `Invalid vault path format: ${vaultPath}`,
      "error",
      "Vault path should be in format: secret/data/path/to/secret"
    );
    return;
  }

  // Warn if not using recommended format
  if (!vaultPath.startsWith("secret/")) {
    addWarning(
      result,
      layer,
      fieldPath,
      `Vault path does not start with 'secret/': ${vaultPath}`,
      "Typical vault paths start with 'secret/' - ensure this is correct"
    );
  }
}

/**
 * Validates a secret file path exists
 */
function validateSecretFilePath(
  filePath: string,
  fieldPath: string,
  layer: string,
  platformDir: string,
  envVars: Map<string, string>,
  result: ValidationResult
): void {
  if (!filePath || filePath.trim() === "") {
    return; // Optional field
  }

  // Expand environment variables
  let expandedPath = filePath;

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

  // Resolve path
  const resolvedPath = path.isAbsolute(expandedPath)
    ? expandedPath
    : path.resolve(platformDir, expandedPath);

  // Check if file exists
  if (!fs.existsSync(resolvedPath)) {
    addError(
      result,
      layer,
      fieldPath,
      `Secret file not found: ${filePath}`,
      "error",
      `Create the file at ${filePath} or use an environment variable (*_env_var) or vault path (*_vault_path) instead`
    );
    return;
  }

  // Warn about file paths (should use env vars or vault)
  if (!filePath.startsWith("~") && !filePath.startsWith("/")) {
    addWarning(
      result,
      layer,
      fieldPath,
      `Secret file uses relative path: ${filePath}`,
      `For better security, use:
- Environment variable (${fieldPath.replace(/_path$/, "_env_var")})
- Vault path (${fieldPath.replace(/_path$/, "_vault_path")})
- Absolute path outside repository`
    );
  }

  // Check if file is in repository (security risk)
  const gitDir = findGitRoot(platformDir);
  if (gitDir && resolvedPath.startsWith(gitDir)) {
    addWarning(
      result,
      layer,
      fieldPath,
      `Secret file is inside Git repository: ${filePath}`,
      `CRITICAL: Ensure ${path.basename(filePath)} is in .gitignore or use environment variables instead`
    );
  }
}

/**
 * Finds the git root directory
 */
function findGitRoot(startDir: string): string | null {
  let currentDir = startDir;

  while (currentDir !== path.dirname(currentDir)) {
    if (fs.existsSync(path.join(currentDir, ".git"))) {
      return currentDir;
    }
    currentDir = path.dirname(currentDir);
  }

  return null;
}
