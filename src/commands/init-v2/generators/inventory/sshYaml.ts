/**
 * Generate inventory/{region}/datacenters/{dc}/ssh.yaml
 * Generate .ssh/ directory structure
 */

import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { GeneratorContext, DatacenterConfig, RegionConfig } from "../../types";

interface SshYamlOptions {
  ctx: GeneratorContext;
  region: RegionConfig;
  datacenter: DatacenterConfig;
}

/**
 * SSH user types
 */
export const SSH_USERS = [
  { name: "admin", comment: "Primary administrator" },
  { name: "backup", comment: "Backup administrator" },
];

/**
 * Generate SSH key pair for a user in a datacenter
 * @returns true if successful, false if failed
 */
export function generateSshKeyPair(sshDir: string, dcName: string, userName: string): boolean {
  const keyName = `${dcName}_${userName}`;
  const privateKeyPath = path.join(sshDir, keyName);

  try {
    execSync(
      `ssh-keygen -t ed25519 -f "${privateKeyPath}" -N "" -C "soverstack_${userName}@${dcName}"`,
      { stdio: "pipe" }
    );
    return true;
  } catch {
    // Fallback for Windows or if ed25519 not supported
    try {
      execSync(
        `ssh-keygen -t rsa -b 4096 -f "${privateKeyPath}" -N "" -C "soverstack_${userName}@${dcName}"`,
        { stdio: "pipe" }
      );
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Get rotation days based on infrastructure tier
 */
function getRotationDays(tier: string): { max: number; warning: number } {
  switch (tier) {
    case "local":
      return { max: 365, warning: 60 };
    case "enterprise":
      return { max: 60, warning: 7 };
    case "production":
    default:
      return { max: 90, warning: 14 };
  }
}

/**
 * Generate ssh.yaml for a specific datacenter
 */
export function generateSshYaml({ ctx, region, datacenter }: SshYamlOptions): void {
  const { projectPath, options } = ctx;
  const dcDir = path.join(
    projectPath,
    "inventory",
    region.name,
    "datacenters",
    datacenter.fullName
  );
  const filePath = path.join(dcDir, "ssh.yaml");

  // Ensure directory exists
  fs.mkdirSync(dcDir, { recursive: true });

  const rotation = getRotationDays(options.infrastructureTier);

  const content = `# ==============================================================================
# SSH CONFIGURATION: ${datacenter.fullName.toUpperCase()} (${region.name.toUpperCase()})
# ==============================================================================
#
# SSH access configuration for this datacenter.
# Keys are stored in .ssh/ (paths relative to platform.yaml)
#
# SECURITY:
# - Minimum 2 sudo-enabled users required
# - SSH key rotation is ENFORCED
# - knockd is REQUIRED - SSH port is closed by default
# - NEVER store raw private keys in this repository
#
# ==============================================================================

datacenter: ${datacenter.fullName}
region: ${region.name}

# ------------------------------------------------------------------------------
# KEY ROTATION POLICY
# ------------------------------------------------------------------------------

rotation_policy:
  max_age_days: ${rotation.max}
  warning_days: ${rotation.warning}
  # Tier: ${options.infrastructureTier}

# ------------------------------------------------------------------------------
# KNOCKD CONFIGURATION
# ------------------------------------------------------------------------------
# SSH port is CLOSED by default. Use knockd to open it.
# To connect: knock -v <host> 7000 8500 9000 12000 && ssh user@host
# Interface is auto-detected by Soverstack during bootstrap.

knockd:
  enabled: true
  sequence: [7000, 8500, 9000, 12000]
  seq_timeout: 5
  port_timeout: 30

# ------------------------------------------------------------------------------
# SSH USERS
# ------------------------------------------------------------------------------
# Minimum 2 sudo users required for redundancy.
# Each user has their own key pair for isolation.

users:
  # Primary administrator
  - user: soverstack_admin
    groups: [sudo]
    shell: /bin/bash
    public_key:
      type: file
      path: .ssh/${datacenter.fullName}_admin.pub
    private_key:
      type: file
      path: .ssh/${datacenter.fullName}_admin

  # Backup administrator
  - user: soverstack_backup
    groups: [sudo]
    shell: /bin/bash
    public_key:
      type: file
      path: .ssh/${datacenter.fullName}_backup.pub
    private_key:
      type: file
      path: .ssh/${datacenter.fullName}_backup

# SSH hardening best practices are applied automatically by Soverstack:
# - Password authentication disabled
# - Root login disabled
# - Only key-based authentication allowed
# - Idle timeout configured
`;

  fs.writeFileSync(filePath, content.trim() + "\n");
}

/**
 * Check if SSH keys already exist for given datacenters
 * @returns List of existing key names
 */
export function checkExistingSshKeys(sshDir: string, datacenterNames: string[]): string[] {
  const existingKeys: string[] = [];

  for (const dc of datacenterNames) {
    for (const user of SSH_USERS) {
      const keyName = `${dc}_${user.name}`;
      const privateKeyPath = path.join(sshDir, keyName);
      if (fs.existsSync(privateKeyPath)) {
        existingKeys.push(keyName);
      }
    }
  }

  return existingKeys;
}

/**
 * Generate SSH keys for all datacenters (if requested)
 */
export function generateSshKeys(
  ctx: GeneratorContext,
  datacenters: { region: RegionConfig; dc: DatacenterConfig }[]
): void {
  const { projectPath, options } = ctx;
  const sshDir = path.join(projectPath, ".ssh");

  // Create .ssh directory
  fs.mkdirSync(sshDir, { recursive: true });

  if (options.generateSshKeys) {
    // Generate actual keys for each datacenter and user
    for (const { dc } of datacenters) {
      for (const user of SSH_USERS) {
        generateSshKeyPair(sshDir, dc.fullName, user.name);
      }
    }
  } else {
    // Just create .gitkeep
    fs.writeFileSync(path.join(sshDir, ".gitkeep"), "");
  }
}
