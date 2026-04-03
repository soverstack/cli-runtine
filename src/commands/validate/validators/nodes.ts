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
    addError(r, file, "No nodes defined. At least one Proxmox server is required", "nodes");
    return r;
  }

  // ── Node count per tier ──────────────────────────────────────────────
  const minNodes = dc.type === "hub"
    ? (tier === "local" ? 1 : 2)
    : (tier === "enterprise" ? 5 : tier === "production" ? 3 : 1);

  if (parsed.nodes.length < minNodes) {
    addError(r, file,
      `Found ${parsed.nodes.length} node(s) but the ${tier} tier requires at least ${minNodes} for a ${dc.type} datacenter`,
      "nodes",
      tier !== "local" ? "Add more servers or change the infrastructure tier" : undefined,
    );
  }

  // ── Individual nodes ─────────────────────────────────────────────────
  const nodeNames = new Set<string>();
  let primaryCount = 0;

  for (const node of parsed.nodes) {
    const label = node.name ? `Node "${node.name}"` : "A node";

    if (!node.name) {
      addError(r, file, "A node is missing a name", "nodes.name");
    } else if (nodeNames.has(node.name)) {
      addError(r, file, `Node "${node.name}" is defined more than once`, "nodes.name");
    } else {
      nodeNames.add(node.name);
    }

    if (!node.public_ip) {
      addError(r, file, `${label}: Missing public IP address`, "nodes.public_ip", "Add the server IP from your provider");
    } else if (!IP_RE.test(node.public_ip)) {
      addError(r, file, `${label}: "${node.public_ip}" is not a valid IP address (e.g., 203.0.113.10)`, "nodes.public_ip");
    } else {
      const octets = node.public_ip.split(".").map(Number);
      if (octets.some((o) => o < 0 || o > 255)) {
        addError(r, file, `${label}: IP address "${node.public_ip}" has octets outside 0-255`, "nodes.public_ip");
      }
    }

    if (!node.role) {
      addError(r, file, `${label}: Missing role (primary or secondary)`, "nodes.role");
    } else if (!VALID_NODE_ROLES.includes(node.role)) {
      addError(r, file, `${label}: Role "${node.role}" is not valid. Use: ${VALID_NODE_ROLES.join(" or ")}`, "nodes.role");
    } else if (node.role === "primary") {
      primaryCount++;
    }

    if (node.capabilities && Array.isArray(node.capabilities)) {
      for (const cap of node.capabilities) {
        if (!VALID_NODE_CAPABILITIES.includes(cap)) {
          addWarning(r, file, `${label}: Unknown capability "${cap}". Known capabilities: ${VALID_NODE_CAPABILITIES.join(", ")}`, "nodes.capabilities");
        }
      }
    }

    if (node.bootstrap) {
      if (!node.bootstrap.user) {
        addError(r, file, `${label}: Missing bootstrap user (usually "root")`, "nodes.bootstrap.user");
      }
      if (node.bootstrap.port !== undefined) {
        if (node.bootstrap.port < 1 || node.bootstrap.port > 65535) {
          addError(r, file, `${label}: Bootstrap port ${node.bootstrap.port} is outside valid range (1-65535)`, "nodes.bootstrap.port");
        }
      }
      if (node.bootstrap.password) {
        const pwd = node.bootstrap.password;
        if (!pwd.type || !VALID_CREDENTIAL_TYPES.includes(pwd.type)) {
          addError(r, file, `${label}: Bootstrap password type is missing or invalid. Use: ${VALID_CREDENTIAL_TYPES.join(", ")}`, "nodes.bootstrap.password.type");
        }
        if (pwd.type === "env" && !pwd.var_name) {
          addError(r, file, `${label}: Bootstrap password uses type "env" but no variable name is specified`, "nodes.bootstrap.password.var_name", "Add: var_name: PVE_<NODE>_BOOTSTRAP_PASSWORD");
        }
        if ((pwd.type === "vault" || pwd.type === "file") && !pwd.path) {
          addError(r, file, `${label}: Bootstrap password uses type "${pwd.type}" but no path is specified`, "nodes.bootstrap.password.path");
        }
      }
    }
  }

  // ── Exactly one primary ──────────────────────────────────────────────
  if (primaryCount === 0) {
    addError(r, file, "No primary node defined. Exactly one node must have role: primary", "nodes.role");
  } else if (primaryCount > 1) {
    addError(r, file, `${primaryCount} nodes are marked as primary, but only one is allowed`, "nodes.role");
  }

  // ── Ceph (zones only) ───────────────────────────────────────────────
  if (dc.type === "zone" && parsed.ceph?.enabled) {
    if (parsed.nodes.length < 3) {
      addWarning(r, file, `Ceph is enabled but only ${parsed.nodes.length} node(s) defined. Ceph needs at least 3 nodes for quorum`, "ceph");
    }
  }

  return r;
}
