/**
 * Validate ssh.yaml files
 */

import fs from "fs";
import path from "path";

import {
  ValidationResult,
  ParsedSsh,
  DiscoveredDatacenter,
  createResult,
  addError,
  addWarning,
  VALID_CREDENTIAL_TYPES,
} from "../types";

export function validateSsh(
  parsed: ParsedSsh,
  dc: DiscoveredDatacenter,
  projectPath: string
): ValidationResult {
  const r = createResult();
  const file = `inventory/${dc.region}/datacenters/${dc.name}/ssh.yaml`;

  // ── Rotation policy ──────────────────────────────────────────────────
  if (!parsed.rotation_policy) {
    addError(r, file, "rotation_policy is required", "rotation_policy");
  } else {
    const rp = parsed.rotation_policy;
    if (!rp.max_age_days || rp.max_age_days <= 0) {
      addError(r, file, "rotation_policy.max_age_days must be > 0", "rotation_policy.max_age_days");
    }
    if (!rp.warning_days || rp.warning_days <= 0) {
      addError(r, file, "rotation_policy.warning_days must be > 0", "rotation_policy.warning_days");
    }
    if (rp.max_age_days && rp.warning_days && rp.warning_days >= rp.max_age_days) {
      addError(r, file, "rotation_policy.warning_days must be < max_age_days", "rotation_policy.warning_days");
    }
  }

  // ── Knockd ───────────────────────────────────────────────────────────
  if (parsed.knockd) {
    const k = parsed.knockd;
    if (k.enabled === true) {
      if (!k.sequence || !Array.isArray(k.sequence) || k.sequence.length === 0) {
        addError(r, file, "knockd.sequence is required when enabled", "knockd.sequence");
      }
      if (!k.seq_timeout || k.seq_timeout <= 0) {
        addError(r, file, "knockd.seq_timeout must be > 0", "knockd.seq_timeout");
      }
      if (!k.port_timeout || k.port_timeout <= 0) {
        addError(r, file, "knockd.port_timeout must be > 0", "knockd.port_timeout");
      }
    }
  }

  // ── Users ────────────────────────────────────────────────────────────
  if (!parsed.users || !Array.isArray(parsed.users) || parsed.users.length < 2) {
    addError(r, file, "Minimum 2 SSH users required (for rotation)", "users");
    return r;
  }

  const userNames = new Set<string>();

  for (const user of parsed.users) {
    // Username
    if (!user.user) {
      addError(r, file, "SSH user.user is required", "users[].user");
    } else if (userNames.has(user.user)) {
      addError(r, file, `Duplicate SSH user: ${user.user}`, "users[].user");
    } else {
      userNames.add(user.user);
    }

    // Groups
    if (!user.groups || !Array.isArray(user.groups) || user.groups.length === 0) {
      addWarning(r, file, `User ${user.user || "?"}: no groups defined`, "users[].groups");
    }

    // Shell
    if (!user.shell) {
      addWarning(r, file, `User ${user.user || "?"}: shell not defined`, "users[].shell");
    }

    // Public key
    validateKeyRef(r, file, user.public_key, user.user || "?", "public_key", projectPath);

    // Private key
    validateKeyRef(r, file, user.private_key, user.user || "?", "private_key", projectPath);
  }

  return r;
}

function validateKeyRef(
  r: ValidationResult,
  file: string,
  key: { type?: string; path?: string; var_name?: string } | undefined,
  userName: string,
  keyType: string,
  projectPath: string
): void {
  if (!key) {
    addError(r, file, `User ${userName}: ${keyType} is required`, `users[].${keyType}`);
    return;
  }

  if (!key.type || !VALID_CREDENTIAL_TYPES.includes(key.type)) {
    addError(r, file, `User ${userName}: ${keyType}.type must be one of: ${VALID_CREDENTIAL_TYPES.join(", ")}`, `users[].${keyType}.type`);
    return;
  }

  if (key.type === "file") {
    if (!key.path) {
      addError(r, file, `User ${userName}: ${keyType}.path required for type: file`, `users[].${keyType}.path`);
    } else {
      // Check file exists relative to project root
      const fullPath = path.resolve(projectPath, key.path);
      if (!fs.existsSync(fullPath)) {
        addWarning(r, file, `User ${userName}: ${keyType} file not found: ${key.path}`, `users[].${keyType}.path`, "Generate keys with: soverstack generate:ssh-keys");
      }
    }
  }

  if (key.type === "env") {
    if (!key.var_name) {
      addError(r, file, `User ${userName}: ${keyType}.var_name required for type: env`, `users[].${keyType}.var_name`);
    }
  }

  if (key.type === "vault") {
    if (!key.path) {
      addError(r, file, `User ${userName}: ${keyType}.path required for type: vault`, `users[].${keyType}.path`);
    }
  }
}
