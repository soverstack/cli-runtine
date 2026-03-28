/**
 * Validate region.yaml files
 */

import {
  ValidationResult,
  ParsedRegion,
  DiscoveredRegion,
  DiscoveredTopology,
  createResult,
  addError,
  addWarning,
} from "../types";

const NAME_RE = /^[a-z0-9-]+$/;
const DNS_ZONE_RE = /^[a-z0-9]+([-\.]{1}[a-z0-9]+)*\.[a-z]{2,}$/i;

export function validateRegion(
  parsed: ParsedRegion,
  discovered: DiscoveredRegion,
  topology: DiscoveredTopology
): ValidationResult {
  const r = createResult();
  const file = `inventory/${discovered.name}/region.yaml`;

  // ── Name ─────────────────────────────────────────────────────────────
  if (!parsed.name) {
    addError(r, file, "name is required", "name");
  } else if (!NAME_RE.test(parsed.name)) {
    addError(r, file, "name must be lowercase alphanumeric with hyphens", "name");
  } else if (parsed.name !== discovered.name) {
    addError(r, file, `name "${parsed.name}" does not match directory name "${discovered.name}"`, "name");
  }

  // ── DNS zone ─────────────────────────────────────────────────────────
  if (!parsed.dns_zone) {
    addError(r, file, "dns_zone is required", "dns_zone");
  } else if (!DNS_ZONE_RE.test(parsed.dns_zone)) {
    addError(r, file, "dns_zone format is invalid", "dns_zone");
  }

  // ── Hub reference ────────────────────────────────────────────────────
  if (parsed.hub) {
    // Hub must exist as a hub-* datacenter somewhere in the topology
    const hubDc = topology.allDatacenters.find((dc) => dc.name === parsed.hub);
    if (!hubDc) {
      addError(r, file, `hub "${parsed.hub}" not found in any region`, "hub", "Hub must be a hub-* directory in inventory/<region>/datacenters/");
    } else if (hubDc.type !== "hub") {
      addError(r, file, `hub "${parsed.hub}" is not a hub datacenter (prefix must be hub-)`, "hub");
    }
  }

  // ── Tier constraints ─────────────────────────────────────────────────
  if (topology.tier === "local") {
    // Local: no hub expected
    if (parsed.hub) {
      addWarning(r, file, "hub is set but tier is local (hubs are not used in local tier)", "hub");
    }
    // Local: should not have hub-* datacenters
    const hubs = discovered.datacenters.filter((dc) => dc.type === "hub");
    if (hubs.length > 0) {
      addWarning(r, file, `Hub datacenters found in local tier: ${hubs.map((h) => h.name).join(", ")}`, undefined, "Remove hub-* directories or change tier");
    }
  } else {
    // Production/Enterprise: hub required (own or shared)
    if (!parsed.hub) {
      addError(r, file, "hub is required for production/enterprise tier", "hub", "Add hub: hub-<name> or reference a shared hub");
    }
  }

  // ── Datacenters discovered ───────────────────────────────────────────
  if (discovered.datacenters.length === 0) {
    addError(r, file, "No datacenters found in inventory/" + discovered.name + "/datacenters/", undefined, "Create at least one zone-* directory");
  }

  // Verify each datacenter has required files
  // (This is checked in detail by nodes/network/ssh validators,
  //  but we flag missing directories here for clarity)
  const zones = discovered.datacenters.filter((dc) => dc.type === "zone");
  if (zones.length === 0) {
    addError(r, file, "At least one zone datacenter is required", undefined, "Create a zone-* directory in datacenters/");
  }

  // ── Compliance ───────────────────────────────────────────────────────
  if (parsed.compliance && !Array.isArray(parsed.compliance)) {
    addError(r, file, "compliance must be an array", "compliance");
  }

  return r;
}

/**
 * Validate global datacenter uniqueness and control plane
 */
export function validateTopologyConstraints(topology: DiscoveredTopology): ValidationResult {
  const r = createResult();
  const file = "inventory/";

  // ── Globally unique datacenter names ─────────────────────────────────
  const seen = new Map<string, string>(); // dc name -> region
  for (const dc of topology.allDatacenters) {
    const existing = seen.get(dc.name);
    if (existing && existing !== dc.region) {
      addError(r, file, `Duplicate datacenter name "${dc.name}" in regions ${existing} and ${dc.region}`, undefined, "Datacenter names must be globally unique");
    }
    seen.set(dc.name, dc.region);
  }

  // ── Control plane datacenter exists ──────────────────────────────────
  if (topology.globalPlacementDc) {
    const cpDc = topology.allDatacenters.find((dc) => dc.name === topology.globalPlacementDc);
    if (!cpDc) {
      addError(r, "platform.yaml", `global_placement datacenter "${topology.globalPlacementDc}" not found in inventory`, "defaults.global_placement.datacenter");
    } else if (cpDc.type !== "zone") {
      addError(r, "platform.yaml", `global_placement datacenter "${topology.globalPlacementDc}" must be a zone (not a hub)`, "defaults.global_placement.datacenter");
    }
  }

  return r;
}
