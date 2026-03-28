/**
 * Cross-file validation (HA constraints, required workloads)
 */

import fs from "fs";
import path from "path";

import {
  ValidationResult,
  DiscoveredTopology,
  createResult,
  addError,
  addWarning,
  REQUIRED_WORKLOADS,
} from "../types";
import { HA_REQUIREMENTS } from "@/constants";

/**
 * Validate required workload files exist
 */
export function validateRequiredWorkloads(topology: DiscoveredTopology): ValidationResult {
  const r = createResult();
  const tier = topology.tier as keyof typeof REQUIRED_WORKLOADS;
  const required = REQUIRED_WORKLOADS[tier];
  if (!required) return r;

  const workloadsDir = path.join(topology.projectPath, "workloads");

  // ── Global workloads ─────────────────────────────────────────────────
  for (const name of required.global) {
    const filePath = path.join(workloadsDir, "global", `${name}.yaml`);
    if (!fs.existsSync(filePath)) {
      addError(r, `workloads/global/${name}.yaml`, `Required global workload "${name}" is missing for ${tier} tier`);
    }
  }

  // ── Regional workloads (per region) ──────────────────────────────────
  for (const region of topology.regions) {
    for (const name of required.regional) {
      const filePath = path.join(workloadsDir, "regional", region.name, `${name}.yaml`);
      if (!fs.existsSync(filePath)) {
        addError(r, `workloads/regional/${region.name}/${name}.yaml`, `Required regional workload "${name}" is missing for region ${region.name}`);
      }
    }
  }

  // ── Zonal workloads (per datacenter) ─────────────────────────────────
  for (const dc of topology.allDatacenters) {
    const requiredFiles = dc.type === "zone" ? required.zonalZone : required.zonalHub;
    for (const name of requiredFiles) {
      const filePath = path.join(workloadsDir, "zonal", dc.region, dc.name, `${name}.yaml`);
      if (!fs.existsSync(filePath)) {
        addError(r, `workloads/zonal/${dc.region}/${dc.name}/${name}.yaml`, `Required zonal workload "${name}" is missing for ${dc.name}`);
      }
    }
  }

  return r;
}

/**
 * Validate HA constraints based on tier
 * Called after all workload files have been parsed
 */
export function validateHaConstraints(
  topology: DiscoveredTopology,
  serviceInstanceCounts: Map<string, number> // "role:scope:location" -> instance count
): ValidationResult {
  const r = createResult();
  const tier = topology.tier as keyof typeof HA_REQUIREMENTS;
  const ha = HA_REQUIREMENTS[tier];
  if (!ha || !ha.ha_required) return r;

  // Critical services that need HA in production/enterprise
  const haRules: { role: string; minInstances: number; label: string }[] = [
    { role: "firewall", minInstances: ha.min_firewall_vms, label: "firewall" },
    { role: "database", minInstances: ha.min_db_nodes, label: "database" },
    { role: "secrets", minInstances: ha.min_secrets_vms, label: "secrets" },
    { role: "identity", minInstances: ha.min_iam_vms, label: "identity" },
    { role: "dns-authoritative", minInstances: ha.min_dns_vms, label: "dns" },
    { role: "mesh", minInstances: ha.min_vpn_vms, label: "mesh" },
  ];

  for (const rule of haRules) {
    // Find all entries for this role
    for (const [key, count] of serviceInstanceCounts) {
      if (key.startsWith(rule.role + ":")) {
        if (count < rule.minInstances) {
          addError(r, "workloads/", `${tier} tier requires at least ${rule.minInstances} ${rule.label} instances, found ${count} in ${key}`);
        }
      }
    }
  }

  // Enterprise: backup is mandatory
  if (tier === "enterprise" && ha.hub_required) {
    const hasBackup = Array.from(serviceInstanceCounts.keys()).some((k) => k.startsWith("backup:"));
    if (!hasBackup) {
      addError(r, "workloads/", "Enterprise tier requires backup workload (hub with backup service)");
    }
  }

  return r;
}
