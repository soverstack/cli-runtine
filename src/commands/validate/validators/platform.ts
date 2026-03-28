/**
 * Validate platform.yaml
 */

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

export function validatePlatform(platform: ParsedPlatform): ValidationResult {
  const r = createResult();

  // ── Required fields ──────────────────────────────────────────────────
  if (!platform.project_name) {
    addError(r, FILE, "project_name is required", "project_name");
  } else if (!NAME_RE.test(platform.project_name)) {
    addError(r, FILE, "project_name must be lowercase alphanumeric with hyphens", "project_name");
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
        addError(r, FILE, "Image name is required", "images[].name");
      } else if (imageNames.has(img.name)) {
        addError(r, FILE, `Duplicate image name: ${img.name}`, "images[].name");
      } else {
        imageNames.add(img.name);
      }

      if (!img.url) {
        addError(r, FILE, `Image ${img.name || "?"} is missing url`, "images[].url");
      }

      if (img.default === true) defaultCount++;
    }

    if (defaultCount === 0) {
      addError(r, FILE, "Exactly one image must have default: true", "images[].default");
    } else if (defaultCount > 1) {
      addError(r, FILE, `Only one image can be default (found ${defaultCount})`, "images[].default");
    }
  }

  // ── Flavors ──────────────────────────────────────────────────────────
  if (!platform.flavors || !Array.isArray(platform.flavors) || platform.flavors.length === 0) {
    addError(r, FILE, "At least one flavor is required", "flavors");
  } else {
    const flavorNames = new Set<string>();

    for (const f of platform.flavors) {
      if (!f.name) {
        addError(r, FILE, "Flavor name is required", "flavors[].name");
      } else if (flavorNames.has(f.name)) {
        addError(r, FILE, `Duplicate flavor name: ${f.name}`, "flavors[].name");
      } else {
        flavorNames.add(f.name);
      }

      if (!f.cpu || f.cpu <= 0) {
        addError(r, FILE, `Flavor ${f.name || "?"}: cpu must be > 0`, "flavors[].cpu");
      }
      if (!f.ram || f.ram <= 0) {
        addError(r, FILE, `Flavor ${f.name || "?"}: ram must be > 0`, "flavors[].ram");
      }
      if (!f.disk || f.disk <= 0) {
        addError(r, FILE, `Flavor ${f.name || "?"}: disk must be > 0`, "flavors[].disk");
      }
    }
  }

  // ── Global placement ─────────────────────────────────────────────────
  if (!platform.defaults?.global_placement?.datacenter) {
    addError(r, FILE, "defaults.global_placement.datacenter is required", "defaults.global_placement.datacenter");
  }

  // ── State ────────────────────────────────────────────────────────────
  if (!platform.state) {
    addError(r, FILE, "state is required", "state");
  } else {
    if (!platform.state.backend) {
      addError(r, FILE, "state.backend is required", "state.backend");
    } else if (!VALID_STATE_BACKENDS.includes(platform.state.backend)) {
      addError(r, FILE, `state.backend must be one of: ${VALID_STATE_BACKENDS.join(", ")}`, "state.backend");
    }

    if (!platform.state.path) {
      addError(r, FILE, "state.path is required", "state.path");
    }

    if (platform.state.backend === "remote") {
      if (!platform.state.remote?.url) {
        addError(r, FILE, "state.remote.url is required when backend is remote", "state.remote.url");
      }
      if (!platform.state.remote?.credentials) {
        addError(r, FILE, "state.remote.credentials is required when backend is remote", "state.remote.credentials");
      } else {
        const cred = platform.state.remote.credentials;
        if (!cred.type || !VALID_CREDENTIAL_TYPES.includes(cred.type)) {
          addError(r, FILE, `state.remote.credentials.type must be one of: ${VALID_CREDENTIAL_TYPES.join(", ")}`, "state.remote.credentials.type");
        }
        if (cred.type === "env" && !cred.var_name) {
          addError(r, FILE, "state.remote.credentials.var_name required for type: env", "state.remote.credentials.var_name");
        }
        if ((cred.type === "vault" || cred.type === "file") && !cred.path) {
          addError(r, FILE, `state.remote.credentials.path required for type: ${cred.type}`, "state.remote.credentials.path");
        }
      }
    }
  }

  return r;
}
