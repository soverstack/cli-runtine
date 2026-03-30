/**
 * Validate ssh.yaml files
 *
 * Also checks SSH key file age against rotation_policy.
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
    addError(r, file, "Missing rotation_policy. SSH key rotation must be configured", "rotation_policy");
  } else {
    const rp = parsed.rotation_policy;
    if (!rp.max_age_days || rp.max_age_days <= 0) {
      addError(r, file, "rotation_policy.max_age_days must be greater than 0", "rotation_policy.max_age_days");
    }
    if (!rp.warning_days || rp.warning_days <= 0) {
      addError(r, file, "rotation_policy.warning_days must be greater than 0", "rotation_policy.warning_days");
    }
    if (rp.max_age_days && rp.warning_days && rp.warning_days >= rp.max_age_days) {
      addError(r, file,
        `rotation_policy.warning_days (${rp.warning_days}) must be less than max_age_days (${rp.max_age_days})`,
        "rotation_policy.warning_days",
      );
    }
  }

  // ── Knockd ───────────────────────────────────────────────────────────
  if (parsed.knockd) {
    const k = parsed.knockd;
    if (k.enabled === true) {
      if (!k.sequence || !Array.isArray(k.sequence) || k.sequence.length === 0) {
        addError(r, file, "knockd is enabled but no port sequence is defined", "knockd.sequence");
      }
      if (!k.seq_timeout || k.seq_timeout <= 0) {
        addError(r, file, "knockd.seq_timeout must be greater than 0 (seconds)", "knockd.seq_timeout");
      }
      if (!k.port_timeout || k.port_timeout <= 0) {
        addError(r, file, "knockd.port_timeout must be greater than 0 (seconds)", "knockd.port_timeout");
      }
    }
  }

  // ── Users ────────────────────────────────────────────────────────────
  if (!parsed.users || !Array.isArray(parsed.users) || parsed.users.length < 2) {
    addError(r, file,
      `At least 2 SSH users are required (found ${parsed.users?.length || 0}). Two users are needed so one can be used to rotate the other's keys safely`,
      "users",
    );
    return r;
  }

  const userNames = new Set<string>();

  for (const user of parsed.users) {
    if (!user.user) {
      addError(r, file, "An SSH user is missing a username", "users.user");
    } else if (userNames.has(user.user)) {
      addError(r, file, `SSH user "${user.user}" is defined more than once`, "users.user");
    } else {
      userNames.add(user.user);
    }

    if (!user.groups || !Array.isArray(user.groups) || user.groups.length === 0) {
      addWarning(r, file, `User "${user.user || "?"}": no groups defined (should be in sudo group)`, "users.groups");
    }

    if (!user.shell) {
      addWarning(r, file, `User "${user.user || "?"}": no shell defined`, "users.shell");
    }

    // Keys
    validateKeyRef(r, file, user.public_key, user.user || "?", "public_key", projectPath, parsed.rotation_policy);
    validateKeyRef(r, file, user.private_key, user.user || "?", "private_key", projectPath, parsed.rotation_policy);
  }

  return r;
}

// ════════════════════════════════════════════════════════════════════════════

function validateKeyRef(
  r: ValidationResult,
  file: string,
  key: { type?: string; path?: string; var_name?: string } | undefined,
  userName: string,
  keyType: string,
  projectPath: string,
  rotationPolicy?: { max_age_days?: number; warning_days?: number },
): void {
  if (!key) {
    addError(r, file,
      `User "${userName}": Missing ${keyType} configuration`,
      `users.${keyType}`,
    );
    return;
  }

  if (!key.type || !VALID_CREDENTIAL_TYPES.includes(key.type)) {
    addError(r, file,
      `User "${userName}": ${keyType}.type must be one of: ${VALID_CREDENTIAL_TYPES.join(", ")}`,
      `users.${keyType}.type`,
    );
    return;
  }

  if (key.type === "file") {
    if (!key.path) {
      addError(r, file,
        `User "${userName}": ${keyType} is type "file" but no path is specified`,
        `users.${keyType}.path`,
      );
    } else {
      const fullPath = path.resolve(projectPath, key.path);

      if (!fs.existsSync(fullPath)) {
        addWarning(r, file,
          `User "${userName}": ${keyType} file not found at "${key.path}"`,
          `users.${keyType}.path`,
          "Generate keys with: soverstack generate ssh",
        );
      } else {
        // Check key age against rotation policy
        checkKeyAge(r, file, fullPath, key.path, userName, keyType, rotationPolicy);
      }
    }
  }

  if (key.type === "env") {
    if (!key.var_name) {
      addError(r, file,
        `User "${userName}": ${keyType} is type "env" but no var_name is specified`,
        `users.${keyType}.var_name`,
      );
    }
  }

  if (key.type === "vault") {
    if (!key.path) {
      addError(r, file,
        `User "${userName}": ${keyType} is type "vault" but no Vault path is specified`,
        `users.${keyType}.path`,
      );
    }
  }
}

// ════════════════════════════════════════════════════════════════════════════

function checkKeyAge(
  r: ValidationResult,
  file: string,
  fullPath: string,
  relativePath: string,
  userName: string,
  keyType: string,
  rotationPolicy?: { max_age_days?: number; warning_days?: number },
): void {
  if (!rotationPolicy?.max_age_days) return;

  try {
    const stats = fs.statSync(fullPath);
    const ageMs = Date.now() - stats.mtimeMs;
    const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24));
    const maxDays = rotationPolicy.max_age_days;
    const warnDays = rotationPolicy.warning_days || 14;

    if (ageDays > maxDays) {
      addWarning(r, file,
        `User "${userName}": ${keyType} "${relativePath}" is ${ageDays} days old (max: ${maxDays} days). Key has EXPIRED and should be rotated`,
        `users.${keyType}`,
        "Run: soverstack generate ssh",
      );
    } else if (ageDays > maxDays - warnDays) {
      const daysLeft = maxDays - ageDays;
      addWarning(r, file,
        `User "${userName}": ${keyType} "${relativePath}" is ${ageDays} days old. Expires in ${daysLeft} day(s) (max: ${maxDays} days)`,
        `users.${keyType}`,
        "Plan key rotation: soverstack generate ssh",
      );
    }
  } catch {
    // Can't read file stats, skip age check
  }
}
