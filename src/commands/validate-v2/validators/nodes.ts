/**
 * Validate nodes.yaml files
 */

import {
  ValidationResult,
  ParsedNodes,
  DiscoveredDatacenter,
  createResult,
  addError,
  addWarning,
  VALID_NODE_ROLES,
  VALID_NODE_CAPABILITIES,
  VALID_CREDENTIAL_TYPES,
} from "../types";

const IP_RE = /^(\d{1,3}\.){3}\d{1,3}$/;

export function validateNodes(
  parsed: ParsedNodes,
  dc: DiscoveredDatacenter,
  tier: string
): ValidationResult {
  const r = createResult();
  const file = `inventory/${dc.region}/datacenters/${dc.name}/nodes.yaml`;

  // ── Nodes array ──────────────────────────────────────────────────────
  if (!parsed.nodes || !Array.isArray(parsed.nodes) || parsed.nodes.length === 0) {
    addError(r, file, "At least one node is required", "nodes");
    return r;
  }

  // ── Node count per tier ──────────────────────────────────────────────
  const minNodes = dc.type === "hub"
    ? (tier === "local" ? 1 : 2)
    : (tier === "enterprise" ? 5 : tier === "production" ? 3 : 1);

  if (parsed.nodes.length < minNodes) {
    addError(r, file, `${tier} tier requires at least ${minNodes} nodes for ${dc.type}, found ${parsed.nodes.length}`, "nodes");
  }

  // ── Individual nodes ─────────────────────────────────────────────────
  const nodeNames = new Set<string>();
  let primaryCount = 0;

  for (const node of parsed.nodes) {
    // Name
    if (!node.name) {
      addError(r, file, "Node name is required", "nodes[].name");
    } else if (nodeNames.has(node.name)) {
      addError(r, file, `Duplicate node name: ${node.name}`, "nodes[].name");
    } else {
      nodeNames.add(node.name);
    }

    // Address
    if (!node.address) {
      addError(r, file, `Node ${node.name || "?"}: address is required`, "nodes[].address");
    } else if (!IP_RE.test(node.address)) {
      addError(r, file, `Node ${node.name || "?"}: invalid IP address "${node.address}"`, "nodes[].address");
    } else {
      // Validate octets
      const octets = node.address.split(".").map(Number);
      if (octets.some((o) => o < 0 || o > 255)) {
        addError(r, file, `Node ${node.name || "?"}: IP octets must be 0-255`, "nodes[].address");
      }
    }

    // Role
    if (!node.role) {
      addError(r, file, `Node ${node.name || "?"}: role is required`, "nodes[].role");
    } else if (!VALID_NODE_ROLES.includes(node.role)) {
      addError(r, file, `Node ${node.name || "?"}: role must be one of: ${VALID_NODE_ROLES.join(", ")}`, "nodes[].role");
    } else if (node.role === "primary") {
      primaryCount++;
    }

    // Capabilities
    if (node.capabilities && Array.isArray(node.capabilities)) {
      for (const cap of node.capabilities) {
        if (!VALID_NODE_CAPABILITIES.includes(cap)) {
          addWarning(r, file, `Node ${node.name || "?"}: unknown capability "${cap}"`, "nodes[].capabilities");
        }
      }
    }

    // Bootstrap
    if (node.bootstrap) {
      if (!node.bootstrap.user) {
        addError(r, file, `Node ${node.name || "?"}: bootstrap.user is required`, "nodes[].bootstrap.user");
      }
      if (node.bootstrap.port !== undefined) {
        if (node.bootstrap.port < 1 || node.bootstrap.port > 65535) {
          addError(r, file, `Node ${node.name || "?"}: bootstrap.port must be 1-65535`, "nodes[].bootstrap.port");
        }
      }
      if (node.bootstrap.password) {
        const pwd = node.bootstrap.password;
        if (!pwd.type || !VALID_CREDENTIAL_TYPES.includes(pwd.type)) {
          addError(r, file, `Node ${node.name || "?"}: bootstrap.password.type must be one of: ${VALID_CREDENTIAL_TYPES.join(", ")}`, "nodes[].bootstrap.password.type");
        }
        if (pwd.type === "env" && !pwd.var_name) {
          addError(r, file, `Node ${node.name || "?"}: bootstrap.password.var_name required for type: env`, "nodes[].bootstrap.password.var_name");
        }
        if ((pwd.type === "vault" || pwd.type === "file") && !pwd.path) {
          addError(r, file, `Node ${node.name || "?"}: bootstrap.password.path required for type: ${pwd.type}`, "nodes[].bootstrap.password.path");
        }
      }
    }
  }

  // ── Exactly one primary ──────────────────────────────────────────────
  if (primaryCount === 0) {
    addError(r, file, "Exactly one node must have role: primary", "nodes[].role");
  } else if (primaryCount > 1) {
    addError(r, file, `Only one node can be primary (found ${primaryCount})`, "nodes[].role");
  }

  // ── Ceph (zones only) ───────────────────────────────────────────────
  if (dc.type === "zone" && parsed.ceph?.enabled) {
    if (parsed.nodes.length < 3) {
      addWarning(r, file, "Ceph requires at least 3 nodes for quorum", "ceph");
    }
  }

  return r;
}
