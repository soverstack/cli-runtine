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
    addError(r, file, "Missing region name", "name", 'Add: name: <region-name>');
  } else if (!NAME_RE.test(parsed.name)) {
    addError(r, file, `Region name "${parsed.name}" is invalid. Use only lowercase letters, numbers, and hyphens`, "name");
  } else if (parsed.name !== discovered.name) {
    addError(r, file, `Region name "${parsed.name}" does not match the directory name "${discovered.name}". They must be the same`, "name");
  }

  // ── DNS zone ─────────────────────────────────────────────────────────
  if (!parsed.dns_zone) {
    addError(r, file, "Missing DNS zone", "dns_zone", "Add: dns_zone: eu.example.com");
  } else if (!DNS_ZONE_RE.test(parsed.dns_zone)) {
    addError(r, file, `DNS zone "${parsed.dns_zone}" is not a valid domain format (e.g., eu.example.com)`, "dns_zone");
  }

  // ── Hub reference ────────────────────────────────────────────────────
  if (parsed.hub) {
    const hubDc = topology.allDatacenters.find((dc) => dc.name === parsed.hub);
    if (!hubDc) {
      addError(r, file, `Hub "${parsed.hub}" does not exist. No hub-* directory with that name was found in any region`, "hub");
    } else if (hubDc.type !== "hub") {
      addError(r, file, `"${parsed.hub}" is not a hub datacenter. Hub names must start with "hub-"`, "hub");
    }
  }

  // ── Tier constraints ─────────────────────────────────────────────────
  if (topology.tier === "local") {
    if (parsed.hub) {
      addWarning(r, file, "Hub is configured but the infrastructure tier is \"local\" (hubs are only used in production/enterprise)", "hub");
    }
    const hubs = discovered.datacenters.filter((dc) => dc.type === "hub");
    if (hubs.length > 0) {
      addWarning(r, file, `Hub datacenter(s) found but tier is "local": ${hubs.map((h) => h.name).join(", ")}`, undefined, "Remove hub-* directories or change the tier to production/enterprise");
    }
  } else {
    if (!parsed.hub) {
      addError(r, file, `Region "${discovered.name}" has no hub configured. Production and enterprise tiers require a hub for backup and storage`, "hub", "Add: hub: hub-<name> (or reference a hub from another region)");
    }
  }

  // ── Datacenters discovered ───────────────────────────────────────────
  if (discovered.datacenters.length === 0) {
    addError(r, file, `No datacenters found in inventory/${discovered.name}/datacenters/`, undefined, "Create at least one zone-* directory with nodes.yaml, network.yaml, and ssh.yaml");
  }

  const zones = discovered.datacenters.filter((dc) => dc.type === "zone");
  if (zones.length === 0 && discovered.datacenters.length > 0) {
    addError(r, file, "No zone datacenters found. Each region needs at least one zone for production workloads", undefined, "Create a zone-* directory in datacenters/");
  }

  // ── Compliance ───────────────────────────────────────────────────────
  if (parsed.compliance && !Array.isArray(parsed.compliance)) {
    addError(r, file, "Compliance must be a list (e.g., [gdpr, pci-dss])", "compliance");
  }

  return r;
}

/**
 * Validate global datacenter uniqueness and control plane
 */
export function validateTopologyConstraints(topology: DiscoveredTopology): ValidationResult {
  const r = createResult();

  // ── Globally unique datacenter names ─────────────────────────────────
  const seen = new Map<string, string>();
  for (const dc of topology.allDatacenters) {
    const existing = seen.get(dc.name);
    if (existing && existing !== dc.region) {
      addError(r, "inventory/", `Datacenter "${dc.name}" exists in both region "${existing}" and region "${dc.region}". Datacenter names must be unique across the entire project`);
    }
    seen.set(dc.name, dc.region);
  }

  // ── Control plane datacenter exists ──────────────────────────────────
  if (topology.globalPlacementDc) {
    const cpDc = topology.allDatacenters.find((dc) => dc.name === topology.globalPlacementDc);
    if (!cpDc) {
      addError(r, "platform.yaml", `Control plane datacenter "${topology.globalPlacementDc}" was not found in any region. Check defaults.global_placement.datacenter`, "defaults.global_placement.datacenter");
    } else if (cpDc.type !== "zone") {
      addError(r, "platform.yaml", `Control plane datacenter "${topology.globalPlacementDc}" is a hub, but global services must run on a zone. Change global_placement to a zone-* datacenter`, "defaults.global_placement.datacenter");
    }
  }

  return r;
}
