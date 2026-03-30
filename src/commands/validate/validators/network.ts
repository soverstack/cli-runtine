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
    addError(r, file, "No VLANs defined. At least one VLAN is required for network configuration", "vlans");
    return r;
  }

  const vlanIds = new Set<number>();
  const vlanNames = new Set<string>();

  for (const vlan of parsed.vlans) {
    const vlanLabel = vlan.name ? `VLAN "${vlan.name}"` : `VLAN (id: ${vlan.id ?? "?"})`;

    if (vlan.id === undefined || vlan.id === null) {
      addError(r, file, `${vlanLabel}: Missing VLAN id`, "vlans.id");
    } else if (vlanIds.has(vlan.id)) {
      addError(r, file, `VLAN id ${vlan.id} is used more than once. Each VLAN must have a unique id`, "vlans.id");
    } else {
      vlanIds.add(vlan.id);
    }

    if (!vlan.name) {
      addError(r, file, `${vlanLabel}: Missing VLAN name`, "vlans.name");
    } else {
      vlanNames.add(vlan.name);
    }

    if (vlan.subnet && vlan.subnet.length > 0 && !CIDR_RE.test(vlan.subnet)) {
      addError(r, file, `${vlanLabel}: Subnet "${vlan.subnet}" is not valid CIDR format (e.g., 10.1.10.0/24)`, "vlans.subnet");
    }

    if (vlan.mtu !== undefined && vlan.mtu <= 0) {
      addError(r, file, `${vlanLabel}: MTU must be greater than 0`, "vlans.mtu");
    }

    if (vlan.mesh === true && !vlan.gateway) {
      addError(r, file, `${vlanLabel}: Mesh VLANs require a gateway address (the firewall VM will be deployed here)`, "vlans.gateway");
    }
  }

  // ── Required VLANs by DC type ────────────────────────────────────────
  const requiredVlans = dc.type === "hub" ? REQUIRED_HUB_VLANS : REQUIRED_ZONE_VLANS;
  for (const required of requiredVlans) {
    if (!vlanNames.has(required)) {
      addError(r, file, `Missing required VLAN "${required}". Every ${dc.type} datacenter must have a ${required} VLAN`, "vlans");
    }
  }

  // ── Public IPs ───────────────────────────────────────────────────────
  if (!parsed.public_ips) {
    addWarning(r, file, "No public IPs configured. You will need public IPs before deploying services that face the internet", "public_ips", "Configure public_ips before running apply");
  } else {
    if (!parsed.public_ips.type) {
      addError(r, file, "Public IPs are configured but the type is missing. Use: allocated_block or bgp", "public_ips.type");
    } else if (parsed.public_ips.type !== "allocated_block" && parsed.public_ips.type !== "bgp") {
      addError(r, file, `Public IPs type "${parsed.public_ips.type}" is not supported. Use: allocated_block or bgp`, "public_ips.type");
    }

    if (parsed.public_ips.type === "allocated_block") {
      const ab = parsed.public_ips.allocated_block;
      if (!ab) {
        addError(r, file, "Public IPs type is \"allocated_block\" but the block configuration is missing", "public_ips.allocated_block");
      } else {
        if (!ab.block) {
          addWarning(r, file, "Public IP block address is empty (e.g., 203.0.113.0/29)", "public_ips.allocated_block.block", "Fill in the IP block from your provider before apply");
        }
        if (!ab.gateway) {
          addWarning(r, file, "Public IP gateway is empty (e.g., 203.0.113.1)", "public_ips.allocated_block.gateway", "Fill in the gateway from your provider before apply");
        }
        if (!ab.usable_range) {
          addWarning(r, file, "Public IP usable range is empty (e.g., 203.0.113.2-203.0.113.6)", "public_ips.allocated_block.usable_range", "Fill in the usable range from your provider before apply");
        }
      }
    }

    if (parsed.public_ips.type === "bgp") {
      const bgp = parsed.public_ips.bgp;
      if (!bgp) {
        addError(r, file, "Public IPs type is \"bgp\" but the BGP configuration is missing", "public_ips.bgp");
      } else {
        if (!bgp.asn) {
          addError(r, file, "BGP: Missing your ASN number", "public_ips.bgp.asn");
        }
        if (!bgp.upstream_asn) {
          addError(r, file, "BGP: Missing upstream provider ASN number", "public_ips.bgp.upstream_asn");
        }
        if (!bgp.ip_blocks || !Array.isArray(bgp.ip_blocks) || bgp.ip_blocks.length === 0) {
          addError(r, file, "BGP: At least one IP block is required", "public_ips.bgp.ip_blocks");
        }
      }
    }
  }

  return r;
}
