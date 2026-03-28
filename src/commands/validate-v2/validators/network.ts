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
  REQUIRED_ZONE_VLANS,
  REQUIRED_HUB_VLANS,
} from "../types";

const CIDR_RE = /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/;

export function validateNetwork(
  parsed: ParsedNetwork,
  dc: DiscoveredDatacenter
): ValidationResult {
  const r = createResult();
  const file = `inventory/${dc.region}/datacenters/${dc.name}/network.yaml`;

  // ── VLANs ────────────────────────────────────────────────────────────
  if (!parsed.vlans || !Array.isArray(parsed.vlans) || parsed.vlans.length === 0) {
    addError(r, file, "At least one VLAN is required", "vlans");
    return r;
  }

  const vlanIds = new Set<number>();
  const vlanNames = new Set<string>();

  for (const vlan of parsed.vlans) {
    // ID
    if (vlan.id === undefined || vlan.id === null) {
      addError(r, file, "VLAN id is required", "vlans[].id");
    } else if (vlanIds.has(vlan.id)) {
      addError(r, file, `Duplicate VLAN id: ${vlan.id}`, "vlans[].id");
    } else {
      vlanIds.add(vlan.id);
    }

    // Name
    if (!vlan.name) {
      addError(r, file, `VLAN ${vlan.id ?? "?"}: name is required`, "vlans[].name");
    } else {
      vlanNames.add(vlan.name);
    }

    // Subnet
    if (vlan.subnet && vlan.subnet.length > 0 && !CIDR_RE.test(vlan.subnet)) {
      addError(r, file, `VLAN ${vlan.name || vlan.id}: invalid subnet CIDR "${vlan.subnet}"`, "vlans[].subnet");
    }

    // MTU
    if (vlan.mtu !== undefined && vlan.mtu <= 0) {
      addError(r, file, `VLAN ${vlan.name || vlan.id}: mtu must be > 0`, "vlans[].mtu");
    }

    // Mesh VLANs must have gateway
    if (vlan.mesh === true && !vlan.gateway) {
      addError(r, file, `VLAN ${vlan.name || vlan.id}: gateway is required for mesh VLANs`, "vlans[].gateway");
    }
  }

  // ── Required VLANs by DC type ────────────────────────────────────────
  const requiredVlans = dc.type === "hub" ? REQUIRED_HUB_VLANS : REQUIRED_ZONE_VLANS;
  for (const required of requiredVlans) {
    if (!vlanNames.has(required)) {
      addError(r, file, `Required VLAN "${required}" is missing for ${dc.type}`, "vlans");
    }
  }

  // ── Public IPs ───────────────────────────────────────────────────────
  if (!parsed.public_ips) {
    addError(r, file, "public_ips is required", "public_ips");
  } else {
    if (!parsed.public_ips.type) {
      addError(r, file, "public_ips.type is required", "public_ips.type");
    } else if (parsed.public_ips.type !== "allocated_block" && parsed.public_ips.type !== "bgp") {
      addError(r, file, 'public_ips.type must be "allocated_block" or "bgp"', "public_ips.type");
    }

    if (parsed.public_ips.type === "allocated_block") {
      const ab = parsed.public_ips.allocated_block;
      if (!ab) {
        addError(r, file, "public_ips.allocated_block is required when type is allocated_block", "public_ips.allocated_block");
      } else {
        if (!ab.block) {
          addError(r, file, "public_ips.allocated_block.block is required", "public_ips.allocated_block.block");
        }
        if (!ab.gateway) {
          addError(r, file, "public_ips.allocated_block.gateway is required", "public_ips.allocated_block.gateway");
        }
        if (!ab.usable_range) {
          addError(r, file, "public_ips.allocated_block.usable_range is required", "public_ips.allocated_block.usable_range");
        }
      }
    }

    if (parsed.public_ips.type === "bgp") {
      const bgp = parsed.public_ips.bgp;
      if (!bgp) {
        addError(r, file, "public_ips.bgp is required when type is bgp", "public_ips.bgp");
      } else {
        if (!bgp.asn) {
          addError(r, file, "public_ips.bgp.asn is required", "public_ips.bgp.asn");
        }
        if (!bgp.upstream_asn) {
          addError(r, file, "public_ips.bgp.upstream_asn is required", "public_ips.bgp.upstream_asn");
        }
        if (!bgp.ip_blocks || !Array.isArray(bgp.ip_blocks) || bgp.ip_blocks.length === 0) {
          addError(r, file, "public_ips.bgp.ip_blocks requires at least one block", "public_ips.bgp.ip_blocks");
        }
      }
    }
  }

  return r;
}
