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

  for (const name of required.global) {
    const filePath = path.join(workloadsDir, "global", `${name}.yaml`);
    if (!fs.existsSync(filePath)) {
      addError(r, `workloads/global/${name}.yaml`,
        `Missing required workload file "${name}.yaml". The ${tier} tier requires a global ${name} service`,
        undefined,
        `Create the file or run: soverstack init`,
      );
    }
  }

  for (const region of topology.regions) {
    for (const name of required.regional) {
      const filePath = path.join(workloadsDir, "regional", region.name, `${name}.yaml`);
      if (!fs.existsSync(filePath)) {
        addError(r, `workloads/regional/${region.name}/${name}.yaml`,
          `Missing required workload file "${name}.yaml" for region "${region.name}". The ${tier} tier requires a regional ${name} service per region`,
        );
      }
    }
  }

  for (const dc of topology.allDatacenters) {
    const requiredFiles = dc.type === "zone" ? required.zonalZone : required.zonalHub;
    for (const name of requiredFiles) {
      const filePath = path.join(workloadsDir, "zonal", dc.region, dc.name, `${name}.yaml`);
      if (!fs.existsSync(filePath)) {
        addError(r, `workloads/zonal/${dc.region}/${dc.name}/${name}.yaml`,
          `Missing required workload file "${name}.yaml" for datacenter "${dc.name}". Each ${dc.type} must have a ${name} service`,
        );
      }
    }
  }

  return r;
}

/**
 * Validate HA constraints based on tier
 */
export function validateHaConstraints(
  topology: DiscoveredTopology,
  serviceInstanceCounts: Map<string, number>
): ValidationResult {
  const r = createResult();
  const tier = topology.tier as keyof typeof HA_REQUIREMENTS;
  const ha = HA_REQUIREMENTS[tier];
  if (!ha || !ha.ha_required) return r;

  const haRules: { role: string; minInstances: number; label: string }[] = [
    { role: "firewall", minInstances: ha.min_firewall_vms, label: "firewall" },
    { role: "database", minInstances: ha.min_db_nodes, label: "database" },
    { role: "secrets", minInstances: ha.min_secrets_vms, label: "secrets (Vault)" },
    { role: "identity", minInstances: ha.min_iam_vms, label: "identity (Keycloak)" },
    { role: "dns-authoritative", minInstances: ha.min_dns_vms, label: "DNS" },
    { role: "mesh", minInstances: ha.min_vpn_vms, label: "mesh (VPN)" },
  ];

  for (const rule of haRules) {
    for (const [key, count] of serviceInstanceCounts) {
      if (key.startsWith(rule.role + ":")) {
        if (count < rule.minInstances) {
          // Parse location from key format: "role:scope:location"
          const location = key.split(":").slice(2).join(":");
          addError(r, "workloads/",
            `High availability: ${rule.label} has ${count} instance(s) in ${location}, but the ${tier} tier requires at least ${rule.minInstances} for redundancy`,
            undefined,
            `Add more instances to your ${rule.role} service definition`,
          );
        }
      }
    }
  }

  if (tier === "enterprise" && ha.hub_required) {
    const hasBackup = Array.from(serviceInstanceCounts.keys()).some((k) => k.startsWith("backup:"));
    if (!hasBackup) {
      addError(r, "workloads/",
        "Enterprise tier requires a backup service. No backup workload found in any hub datacenter",
        undefined,
        "Create a backup.yaml in a hub datacenter (e.g., workloads/zonal/<region>/hub-<name>/backup.yaml)",
      );
    }
  }

  return r;
}
