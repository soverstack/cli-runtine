/**
 * Validate platform.yaml
 */

import fs from "fs";
import path from "path";

import {
  ValidationResult,
  ParsedPlatform,
  createResult,
  addError,
  addWarning,
  VALID_TIERS,
  VALID_COMPLIANCE,
  VALID_STATE_BACKENDS,
  VALID_CREDENTIAL_TYPES,
} from "../types";

const FILE = "platform.yaml";
const NAME_RE = /^[a-z0-9-]+$/;
const DOMAIN_RE = /^[a-z0-9]+([-\.]{1}[a-z0-9]+)*\.[a-z]{2,}$/i;

export function validatePlatform(platform: ParsedPlatform, projectPath?: string): ValidationResult {
  const r = createResult();

  // ── Required fields ──────────────────────────────────────────────────
  if (!platform.project_name) {
    addError(r, FILE, "Missing project_name", "project_name", "Add: project_name: my-project");
  } else if (!NAME_RE.test(platform.project_name)) {
    addError(r, FILE, `Project name "${platform.project_name}" is invalid. Use only lowercase letters, numbers, and hyphens (e.g., "my-project")`, "project_name");
  }

  if (!platform.version) {
    addError(r, FILE, "version is required", "version");
  }

  if (!platform.domain) {
    addError(r, FILE, "domain is required", "domain");
  } else if (!DOMAIN_RE.test(platform.domain)) {
    addError(r, FILE, "domain format is invalid", "domain");
  }

  // ── Infrastructure tier ──────────────────────────────────────────────
  if (!platform.infrastructure_tier) {
    addError(r, FILE, "infrastructure_tier is required", "infrastructure_tier");
  } else if (!VALID_TIERS.includes(platform.infrastructure_tier)) {
    addError(r, FILE, `infrastructure_tier must be one of: ${VALID_TIERS.join(", ")}`, "infrastructure_tier");
  }

  // ── Compliance level ─────────────────────────────────────────────────
  if (!platform.compliance_level) {
    addError(r, FILE, "compliance_level is required", "compliance_level");
  } else if (!VALID_COMPLIANCE.includes(platform.compliance_level)) {
    addError(r, FILE, `compliance_level must be one of: ${VALID_COMPLIANCE.join(", ")}`, "compliance_level");
  }

  // ── Images ───────────────────────────────────────────────────────────
  if (!platform.images || !Array.isArray(platform.images) || platform.images.length === 0) {
    addError(r, FILE, "At least one image is required", "images");
  } else {
    const imageNames = new Set<string>();
    let defaultCount = 0;

    for (const img of platform.images) {
      if (!img.name) {
        addError(r, FILE, "An image is missing a name", "images.name");
      } else if (imageNames.has(img.name)) {
        addError(r, FILE, `Image "${img.name}" is defined more than once. Each image must have a unique name`, "images.name");
      } else {
        imageNames.add(img.name);
      }

      if (!img.url) {
        addError(r, FILE, `Image "${img.name || "?"}" is missing a download URL`, "images.url");
      }

      if (img.default === true) defaultCount++;
    }

    if (defaultCount === 0) {
      addError(r, FILE, "One image must be marked as default (add: default: true)", "images.default");
    } else if (defaultCount > 1) {
      addError(r, FILE, `Only one image can be the default, but ${defaultCount} images have default: true`, "images.default");
    }
  }

  // ── Flavors ──────────────────────────────────────────────────────────
  if (!platform.flavors || !Array.isArray(platform.flavors) || platform.flavors.length === 0) {
    addError(r, FILE, "At least one flavor is required", "flavors");
  } else {
    const flavorNames = new Set<string>();

    for (const f of platform.flavors) {
      if (!f.name) {
        addError(r, FILE, "A flavor is missing a name", "flavors.name");
      } else if (flavorNames.has(f.name)) {
        addError(r, FILE, `Flavor "${f.name}" is defined more than once. Each flavor must have a unique name`, "flavors.name");
      } else {
        flavorNames.add(f.name);
      }

      if (!f.cpu || f.cpu <= 0) {
        addError(r, FILE, `Flavor "${f.name || "?"}": cpu must be greater than 0`, "flavors.cpu");
      }
      if (!f.ram || f.ram <= 0) {
        addError(r, FILE, `Flavor "${f.name || "?"}": ram (in MB) must be greater than 0`, "flavors.ram");
      }
      if (!f.disk || f.disk <= 0) {
        addError(r, FILE, `Flavor "${f.name || "?"}": disk (in GB) must be greater than 0`, "flavors.disk");
      }
    }
  }

  // ── Global placement ─────────────────────────────────────────────────
  if (!platform.defaults?.global_placement?.datacenter) {
    addError(r, FILE, "Missing control plane datacenter. Add: defaults.global_placement.datacenter: zone-<name>", "defaults.global_placement.datacenter");
  }

  // ── State ────────────────────────────────────────────────────────────
  if (!platform.state) {
    addError(r, FILE, "Missing state configuration", "state", "Add a state section with backend and path");
  } else {
    if (!platform.state.backend) {
      addError(r, FILE, "Missing state backend type", "state.backend", "Add: backend: local (or remote)");
    } else if (!VALID_STATE_BACKENDS.includes(platform.state.backend)) {
      addError(r, FILE, `State backend "${platform.state.backend}" is not supported. Use: ${VALID_STATE_BACKENDS.join(" or ")}`, "state.backend");
    }

    if (!platform.state.path) {
      addError(r, FILE, "Missing state path", "state.path", "Add: path: ./.soverstack/state");
    } else if (projectPath) {
      const statePath = path.resolve(projectPath, platform.state.path);
      if (!fs.existsSync(statePath)) {
        addWarning(r, FILE, `State directory "${platform.state.path}" does not exist yet. It will be created on first apply`, "state.path");
      }
    }

    if (platform.state.backend === "remote") {
      if (!platform.state.remote?.url) {
        addError(r, FILE, "Remote state backend is configured but the URL is missing", "state.remote.url", 'Add "url" under state.remote');
      }
      if (!platform.state.remote?.credentials) {
        addError(r, FILE, "Remote state backend requires credentials to authenticate", "state.remote.credentials", 'Add "credentials" under state.remote with type, and var_name or path');
      } else {
        const cred = platform.state.remote.credentials;
        if (!cred.type || !VALID_CREDENTIAL_TYPES.includes(cred.type)) {
          addError(r, FILE, `Remote state credentials type is missing or invalid. Use: ${VALID_CREDENTIAL_TYPES.join(", ")}`, "state.remote.credentials.type");
        }
        if (cred.type === "env" && !cred.var_name) {
          addError(r, FILE, 'Remote state credentials use type "env" but no environment variable name is specified', "state.remote.credentials.var_name", "Add: var_name: MY_STATE_TOKEN");
        }
        if ((cred.type === "vault" || cred.type === "file") && !cred.path) {
          addError(r, FILE, `Remote state credentials use type "${cred.type}" but no path is specified`, "state.remote.credentials.path");
        }
      }
    }
  }

  return r;
}
