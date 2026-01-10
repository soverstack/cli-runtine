import { ValidationResult, addError, addWarning } from "../utils/types";

// ═══════════════════════════════════════════════════════════════════════════
// SECURITY VALIDATION RULES
// ═══════════════════════════════════════════════════════════════════════════
//
// CRITICAL SECURITY REQUIREMENTS:
// - NEVER store passwords in plain text
// - ALWAYS use environment variables or Vault for secrets
// - SSH private keys MUST NOT be in the repository
// - accessible_outside_vpn MUST be explicitly set (no unsafe defaults)
//
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Validates that no plain text passwords are used
 */
export function validateNoPlainTextPassword(
  password: string | undefined,
  passwordEnvVar: string | undefined,
  passwordVaultPath: string | undefined,
  fieldName: string,
  result: ValidationResult,
  layer: string
): boolean {
  if (password) {
    addError(
      result,
      layer,
      fieldName,
      `Plain text password detected - CRITICAL SECURITY RISK!`,
      "critical",
      `Remove the plain text password and use:
- ${fieldName}_env_var: "ENV_VAR_NAME" (recommended)
- ${fieldName}_vault_path: "secret/data/path" (most secure)`
    );
    return false;
  }

  if (!passwordEnvVar && !passwordVaultPath) {
    addError(
      result,
      layer,
      fieldName,
      `Password must be provided via environment variable or Vault`,
      "error",
      `Add either:
- ${fieldName}_env_var: "ENV_VAR_NAME"
- ${fieldName}_vault_path: "secret/data/path"`
    );
    return false;
  }

  return true;
}

/**
 * Validates that accessible_outside_vpn is explicitly set
 */
export function validateAccessibleOutsideVpn(
  accessibleOutsideVpn: boolean | undefined,
  featureName: string,
  result: ValidationResult,
  layer: string
): boolean {
  if (accessibleOutsideVpn === undefined) {
    addError(
      result,
      layer,
      `${featureName}.accessible_outside_vpn`,
      `accessible_outside_vpn must be explicitly set to true or false`,
      "error",
      `Add: accessible_outside_vpn: false (recommended for security) or true (if public access needed)`
    );
    return false;
  }

  if (accessibleOutsideVpn === true) {
    addWarning(
      result,
      layer,
      `${featureName}.accessible_outside_vpn`,
      `${featureName} is accessible outside VPN - ensure proper authentication is in place`,
      "Consider restricting access to VPN only unless public access is required"
    );
  }

  return true;
}

/**
 * Validates SSH key configuration
 */
export function validateSshKeyConfig(
  publicKeyPath: string | undefined,
  privateKeyPath: string | undefined,
  publicKeyEnvVar: string | undefined,
  privateKeyEnvVar: string | undefined,
  result: ValidationResult,
  layer: string
): boolean {
  // At least one method must be provided
  if (
    !publicKeyPath &&
    !privateKeyPath &&
    !publicKeyEnvVar &&
    !privateKeyEnvVar
  ) {
    addError(
      result,
      layer,
      "ssh_keys",
      "SSH keys must be configured",
      "error",
      `Provide SSH keys via:
- public_key_path and private_key_path (outside repository!)
- public_key_env_var and private_key_env_var (recommended)`
    );
    return false;
  }

  // Warn if using file paths (could be in repo)
  if (publicKeyPath || privateKeyPath) {
    addWarning(
      result,
      layer,
      "ssh_keys",
      "Using file paths for SSH keys - ensure they are OUTSIDE the repository",
      "Consider using environment variables instead for better security"
    );
  }

  return true;
}

/**
 * Validates that OIDC is enforced for Bastion
 */
export function validateBastionOidc(
  oidcEnforced: boolean | undefined,
  result: ValidationResult,
  layer: string
): boolean {
  if (oidcEnforced !== true) {
    addError(
      result,
      layer,
      "oidc_enforced",
      "OIDC must always be enforced for Bastion (oidc_enforced: true)",
      "error",
      "Set oidc_enforced: true - this is mandatory for security"
    );
    return false;
  }

  return true;
}

/**
 * Validates network CIDR format
 */
export function validateCidrFormat(
  cidr: string,
  fieldName: string,
  result: ValidationResult,
  layer: string
): boolean {
  const cidrRegex = /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/;

  if (!cidrRegex.test(cidr)) {
    addError(
      result,
      layer,
      fieldName,
      `Invalid CIDR format: ${cidr}`,
      "error",
      `Use format: x.x.x.x/y (e.g., "10.0.0.0/24")`
    );
    return false;
  }

  // Validate each octet
  const [ip, mask] = cidr.split("/");
  const octets = ip.split(".").map(Number);

  if (octets.some((octet) => octet < 0 || octet > 255)) {
    addError(
      result,
      layer,
      fieldName,
      `Invalid IP address in CIDR: ${cidr}`,
      "error",
      "Each octet must be between 0 and 255"
    );
    return false;
  }

  const maskNum = Number(mask);
  if (maskNum < 0 || maskNum > 32) {
    addError(
      result,
      layer,
      fieldName,
      `Invalid subnet mask in CIDR: ${cidr}`,
      "error",
      "Subnet mask must be between 0 and 32"
    );
    return false;
  }

  return true;
}

/**
 * Validates IP address format
 */
export function validateIpFormat(
  ip: string,
  fieldName: string,
  result: ValidationResult,
  layer: string
): boolean {
  const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;

  if (!ipRegex.test(ip)) {
    addError(
      result,
      layer,
      fieldName,
      `Invalid IP address format: ${ip}`,
      "error",
      `Use format: x.x.x.x (e.g., "192.168.1.1")`
    );
    return false;
  }

  const octets = ip.split(".").map(Number);

  if (octets.some((octet) => octet < 0 || octet > 255)) {
    addError(
      result,
      layer,
      fieldName,
      `Invalid IP address: ${ip}`,
      "error",
      "Each octet must be between 0 and 255"
    );
    return false;
  }

  return true;
}
