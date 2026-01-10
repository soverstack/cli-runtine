import fs from "fs";
import path from "path";
import { ValidationResult, addError, addWarning } from "../utils/types";

/**
 * Validates that a file path exists
 */
export function validateFilePath(
  filePath: string | undefined,
  fieldName: string,
  platformDir: string,
  result: ValidationResult,
  layer: string,
  required: boolean = true
): boolean {
  if (!filePath) {
    if (required) {
      addError(
        result,
        layer,
        fieldName,
        `File path is required for ${fieldName}`,
        "error",
        `Provide a valid file path for ${fieldName}`
      );
      return false;
    }
    return true; // Optional field, no error
  }

  const resolvedPath = path.resolve(platformDir, filePath);

  if (!fs.existsSync(resolvedPath)) {
    addError(
      result,
      layer,
      fieldName,
      `File not found: ${filePath}`,
      "error",
      `Create the file at ${filePath} or provide a valid path`
    );
    return false;
  }

  return true;
}

/**
 * Validates that a directory path exists
 */
export function validateDirectoryPath(
  dirPath: string | undefined,
  fieldName: string,
  platformDir: string,
  result: ValidationResult,
  layer: string,
  required: boolean = true
): boolean {
  if (!dirPath) {
    if (required) {
      addError(
        result,
        layer,
        fieldName,
        `Directory path is required for ${fieldName}`,
        "error",
        `Provide a valid directory path for ${fieldName}`
      );
      return false;
    }
    return true;
  }

  const resolvedPath = path.resolve(platformDir, dirPath);

  if (!fs.existsSync(resolvedPath)) {
    addError(
      result,
      layer,
      fieldName,
      `Directory not found: ${dirPath}`,
      "error",
      `Create the directory at ${dirPath} or provide a valid path`
    );
    return false;
  }

  const stats = fs.statSync(resolvedPath);
  if (!stats.isDirectory()) {
    addError(
      result,
      layer,
      fieldName,
      `Path is not a directory: ${dirPath}`,
      "error",
      `Provide a valid directory path for ${fieldName}`
    );
    return false;
  }

  return true;
}

/**
 * Loads environment variables from .env files
 */
export function loadEnvVariables(
  platformDir: string,
  environment?: string
): Map<string, string> {
  const envVars = new Map<string, string>();

  // Load .env file (base)
  const baseEnvPath = path.join(platformDir, ".env");
  if (fs.existsSync(baseEnvPath)) {
    loadEnvFile(baseEnvPath, envVars);
  }

  // Load environment-specific .env file
  if (environment) {
    const envFilePath = path.join(platformDir, `.env.${environment}`);
    if (fs.existsSync(envFilePath)) {
      loadEnvFile(envFilePath, envVars);
    }
  }

  // Also include process.env
  Object.entries(process.env).forEach(([key, value]) => {
    if (value !== undefined) {
      envVars.set(key, value);
    }
  });

  return envVars;
}

/**
 * Loads variables from a .env file
 */
function loadEnvFile(filePath: string, envVars: Map<string, string>): void {
  try {
    const content = fs.readFileSync(filePath, "utf8");
    const lines = content.split("\n");

    lines.forEach((line) => {
      // Skip empty lines and comments
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        return;
      }

      // Parse KEY=VALUE
      const match = trimmed.match(/^([^=]+)=(.*)$/);
      if (match) {
        const key = match[1].trim();
        let value = match[2].trim();

        // Remove quotes if present
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }

        envVars.set(key, value);
      }
    });
  } catch (error) {
    // Silently fail - file might not exist or be readable
  }
}

/**
 * Validates that an environment variable is defined
 */
export function validateEnvVariable(
  envVarName: string | undefined,
  fieldName: string,
  envVars: Map<string, string>,
  result: ValidationResult,
  layer: string,
  description: string,
  required: boolean = true
): boolean {
  if (!envVarName) {
    if (required) {
      addError(
        result,
        layer,
        fieldName,
        `Environment variable name is required for ${fieldName}`,
        "error",
        `Provide an environment variable name for ${fieldName}`
      );
      return false;
    }
    return true;
  }

  if (!envVars.has(envVarName)) {
    addError(
      result,
      layer,
      fieldName,
      `Environment variable ${envVarName} is not defined`,
      "error",
      `Add ${envVarName}="${description}" to your .env file`
    );
    return false;
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
    return false;
  }

  return true;
}

/**
 * Validates password configuration (must use env_var or vault, not plain text)
 */
export function validatePasswordConfig(
  plainText: string | undefined,
  envVar: string | undefined,
  vaultPath: string | undefined,
  fieldName: string,
  envVars: Map<string, string>,
  result: ValidationResult,
  layer: string
): boolean {
  const hasPlainText = !!plainText;
  const hasEnvVar = !!envVar;
  const hasVaultPath = !!vaultPath;

  // At least one must be provided
  if (!hasPlainText && !hasEnvVar && !hasVaultPath) {
    addError(
      result,
      layer,
      fieldName,
      `Password configuration is required for ${fieldName}`,
      "error",
      `Provide password via env_var (recommended) or vault_path`
    );
    return false;
  }

  // Plain text password - security warning
  if (hasPlainText) {
    addWarning(
      result,
      layer,
      fieldName,
      `Plain text password detected for ${fieldName}`,
      `Use ${fieldName}_env_var or ${fieldName}_vault_path instead for better security`
    );
  }

  // Validate env_var if provided
  if (hasEnvVar) {
    return validateEnvVariable(
      envVar,
      `${fieldName}_env_var`,
      envVars,
      result,
      layer,
      "password",
      true
    );
  }

  // Validate vault_path if provided
  if (hasVaultPath) {
    // Vault path validation would require vault connection
    // For now, just check format
    if (!vaultPath.startsWith("secret/")) {
      addWarning(
        result,
        layer,
        `${fieldName}_vault_path`,
        `Vault path should typically start with 'secret/'`,
        `Ensure vault path is correct: ${vaultPath}`
      );
    }
  }

  return true;
}
