/**
 * Validate network.yaml files
 */

import {
  ValidationResult,
  ParsedNetwork,
  DiscoveredDatacenter,
  createResult,
  addError,
  addWarning,
} from "../types";

const CIDR_RE = /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/;

const REQUIRED_ZONE_NETWORKS = ["management", "corosync", "ceph", "vm"];
const REQUIRED_HUB_NETWORKS = ["management", "backup"];

export function validateNetwork(
  parsed: ParsedNetwork,
  dc: DiscoveredDatacenter,
  tier?: string
): ValidationResult {
  const r = createResult();
  const file = `inventory/${dc.region}/datacenters/${dc.name}/network.yaml`;

  // ── Networks ─────────────────────────────────────────────────────────
  if (!parsed.networks || typeof parsed.networks !== "object" || Object.keys(parsed.networks).length === 0) {
    addError(r, file, "No networks defined. At least a 'management' network is required", "networks");
    return r;
  }

  if (!("management" in parsed.networks)) {
    addError(r, file, "Missing required 'management' network", "networks");
  }

  const subnets = new Set<string>();
  const vlanIds = new Map<string, Set<number>>();

  for (const [name, net] of Object.entries(parsed.networks)) {
    const label = `Network "${name}"`;

    if (net.subnet && net.subnet.length > 0 && !CIDR_RE.test(net.subnet)) {
      addError(r, file, `${label}: Subnet "${net.subnet}" is not valid CIDR format (e.g., 10.1.50.0/24)`, `networks.${name}.subnet`);
    } else if (net.subnet && net.subnet.length > 0) {
      if (subnets.has(net.subnet)) {
        addError(r, file, `${label}: Subnet "${net.subnet}" is used by another network in this datacenter`, `networks.${name}.subnet`);
      }
      subnets.add(net.subnet);
    }

    if (name === "management" && !net.gateway) {
      addError(r, file, `${label}: Management network requires a gateway`, `networks.${name}.gateway`);
    }

    // Validate VLAN backing if present
    if (net.vlan) {
      if (!net.vlan.id || net.vlan.id < 1) {
        addError(r, file, `${label}: VLAN id must be a positive integer`, `networks.${name}.vlan.id`);
      }
      if (!net.vlan.interface) {
        addError(r, file, `${label}: VLAN interface is required (e.g., eth1)`, `networks.${name}.vlan.interface`);
      }
      if (!net.vlan.mtu || net.vlan.mtu <= 0) {
        addError(r, file, `${label}: VLAN mtu must be positive (1500 or 9000)`, `networks.${name}.vlan.mtu`);
      }

      // Check VLAN ID uniqueness per interface
      if (net.vlan.interface && net.vlan.id) {
        const iface = net.vlan.interface;
        if (!vlanIds.has(iface)) vlanIds.set(iface, new Set());
        if (vlanIds.get(iface)!.has(net.vlan.id)) {
          addError(r, file, `${label}: VLAN id ${net.vlan.id} is already used on interface ${iface}`, `networks.${name}.vlan.id`);
        }
        vlanIds.get(iface)!.add(net.vlan.id);
      }
    }
  }

  // ── Required networks by DC type ─────────────────────────────────────
  const required = dc.type === "hub" ? REQUIRED_HUB_NETWORKS : REQUIRED_ZONE_NETWORKS;
  for (const name of required) {
    if (!(name in parsed.networks)) {
      addWarning(r, file, `Missing recommended network "${name}" for a ${dc.type} datacenter`, "networks");
    }
  }

  // ── Public IPs ───────────────────────────────────────────────────────
  if (!parsed.public_ips) {
    addWarning(r, file, "No public IPs configured. You will need public IPs before deploying services that face the internet", "public_ips", "Configure public_ips before running apply");
  } else {
    const type = parsed.public_ips.type;

    if (!type) {
      addError(r, file, "Public IPs type is missing. Use: individual, block, or bgp", "public_ips.type");
    } else if (!["individual", "block", "bgp"].includes(type)) {
      addError(r, file, `Public IPs type "${type}" is not supported. Use: individual, block, or bgp`, "public_ips.type");
    }

    // Enterprise tier cannot use individual IPs (no automatic failover)
    if (type === "individual" && tier === "enterprise") {
      addError(r, file, "Enterprise tier requires 'block' or 'bgp' public IPs. Individual IPs do not support automatic failover (ISO 27001 A.8.14)", "public_ips.type");
    } else if (type === "individual" && tier && tier !== "local") {
      addWarning(r, file, "Individual IPs have limited failover — if a node fails, its IPs become unreachable until manual intervention. Consider 'block' or 'bgp' for production workloads", "public_ips.type");
    }

    if (type === "individual") {
      const addrs = parsed.public_ips.addresses;
      if (!addrs || !Array.isArray(addrs) || addrs.length === 0) {
        addError(r, file, "Individual public IPs require at least one address entry", "public_ips.addresses");
      }
    }

    if (type === "block") {
      if (!parsed.public_ips.block) {
        addWarning(r, file, "Public IP block is empty (e.g., 203.0.113.0/28)", "public_ips.block", "Fill in the IP block from your provider before apply");
      }
      if (!parsed.public_ips.gateway) {
        addWarning(r, file, "Public IP gateway is empty (e.g., 203.0.113.1)", "public_ips.gateway", "Fill in the gateway from your provider before apply");
      }
      if (!parsed.public_ips.usable) {
        addWarning(r, file, "Public IP usable range is empty (e.g., 203.0.113.2-203.0.113.14)", "public_ips.usable", "Fill in the usable range from your provider before apply");
      }
    }

    if (type === "bgp") {
      if (!parsed.public_ips.asn) {
        addError(r, file, "BGP: Missing your ASN number", "public_ips.asn");
      }
      if (!parsed.public_ips.block) {
        addError(r, file, "BGP: Missing IP block", "public_ips.block");
      }
      if (!parsed.public_ips.upstream_peer) {
        addError(r, file, "BGP: Missing upstream peer IP", "public_ips.upstream_peer");
      }
    }
  }

  return r;
}
