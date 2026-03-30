/**
 * Soverstack Validate - Types
 */

// ════════════════════════════════════════════════════════════════════════════
// VALIDATION RESULT
// ════════════════════════════════════════════════════════════════════════════

export type ValidationSeverity = "error" | "warning";

export interface ValidationIssue {
  severity: ValidationSeverity;
  file: string;
  field?: string;
  message: string;
  hint?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

export function createResult(): ValidationResult {
  return { valid: true, errors: [], warnings: [] };
}

export function addError(
  result: ValidationResult,
  file: string,
  message: string,
  field?: string,
  hint?: string,
): void {
  result.valid = false;
  result.errors.push({ severity: "error", file, field, message, hint });
}

export function addWarning(
  result: ValidationResult,
  file: string,
  message: string,
  field?: string,
  hint?: string,
): void {
  result.warnings.push({ severity: "warning", file, field, message, hint });
}

export function mergeResults(target: ValidationResult, source: ValidationResult): void {
  if (!source.valid) target.valid = false;
  target.errors.push(...source.errors);
  target.warnings.push(...source.warnings);
}

// ════════════════════════════════════════════════════════════════════════════
// PARSED STRUCTURES (from YAML files)
// ════════════════════════════════════════════════════════════════════════════

export interface ParsedPlatform {
  project_name?: string;
  version?: string;
  domain?: string;
  infrastructure_tier?: string;
  compliance_level?: string;
  images?: ParsedImage[];
  flavors?: ParsedFlavor[];
  defaults?: {
    global_placement?: {
      datacenter?: string;
    };
  };
  state?: {
    backend?: string;
    path?: string;
    remote?: {
      url?: string;
      credentials?: {
        type?: string;
        var_name?: string;
        path?: string;
      };
    };
  };
}

export interface ParsedImage {
  name?: string;
  url?: string;
  default?: boolean;
}

export interface ParsedFlavor {
  name?: string;
  cpu?: number;
  ram?: number;
  disk?: number;
}

export interface ParsedRegion {
  name?: string;
  description?: string;
  dns_zone?: string;
  hub?: string;
  compliance?: string[];
}

export interface ParsedNode {
  name?: string;
  address?: string;
  role?: string;
  capabilities?: string[];
  bootstrap?: {
    user?: string;
    port?: number;
    password?: {
      type?: string;
      var_name?: string;
      path?: string;
    };
  };
}

export interface ParsedNodes {
  nodes?: ParsedNode[];
  ceph?: {
    enabled?: boolean;
    pool_name?: string;
  };
}

export interface ParsedVlan {
  id?: number;
  name?: string;
  subnet?: string;
  gateway?: string;
  mesh?: boolean;
  mtu?: number;
}

export interface ParsedNetwork {
  vlans?: ParsedVlan[];
  public_ips?: {
    type?: string;
    allocated_block?: {
      block?: string;
      gateway?: string;
      usable_range?: string;
    };
    bgp?: {
      asn?: number;
      upstream_asn?: number;
      ip_blocks?: string[];
    };
  };
}

export interface ParsedSshUser {
  user?: string;
  groups?: string[];
  shell?: string;
  public_key?: {
    type?: string;
    path?: string;
    var_name?: string;
  };
  private_key?: {
    type?: string;
    path?: string;
    var_name?: string;
  };
}

export interface ParsedSsh {
  rotation_policy?: {
    max_age_days?: number;
    warning_days?: number;
  };
  knockd?: {
    enabled?: boolean;
    sequence?: number[];
    seq_timeout?: number;
    port_timeout?: number;
  };
  users?: ParsedSshUser[];
}

export interface ParsedServiceInstance {
  name?: string;
  vm_id?: number;
  flavor?: string;
  disk?: string | number;
  image?: string;
  host?: string;
}

export interface ParsedService {
  role?: string;
  scope?: string;
  region?: string;
  datacenter?: string;
  implementation?: string;
  version?: string;
  instances?: ParsedServiceInstance[];
  overwrite_config?: Record<string, unknown>;
}

export interface ParsedWorkloadFile {
  services?: ParsedService[];
}

// ════════════════════════════════════════════════════════════════════════════
// DISCOVERED TOPOLOGY (from filesystem scan)
// ════════════════════════════════════════════════════════════════════════════

export interface DiscoveredDatacenter {
  name: string;
  type: "hub" | "zone";
  region: string;
  dirPath: string;
}

export interface DiscoveredRegion {
  name: string;
  dirPath: string;
  datacenters: DiscoveredDatacenter[];
}

export interface DiscoveredTopology {
  projectPath: string;
  regions: DiscoveredRegion[];
  allDatacenters: DiscoveredDatacenter[];
  allNodeNames: Map<string, string[]>; // dc name -> node names
  flavorNames: string[];
  imageNames: string[];
  globalPlacementDc?: string;
  tier: string;
}

// ════════════════════════════════════════════════════════════════════════════
// VM ID SCHEME (re-exported for validation)
// ════════════════════════════════════════════════════════════════════════════
//
// vm_id = SCOPE_BASE + regionId × 100000 + dcId × 1000 + ROLE_OFFSET + instance
//
// GLOBAL:    1000 + roleOffset + instance
// REGIONAL:  regionId × 100000 + roleOffset + instance  (dcId = 0)
// ZONAL:     regionId × 100000 + dcId × 1000 + roleOffset + instance
//
// Validation: check that vm_id falls within the expected scope range
// and is globally unique.

export { GLOBAL_BASE, REGION_BLOCK, DC_BLOCK, ROLE_OFFSETS, vmId } from "../../commands/init/types";

/** Validate that a vm_id is in the correct scope range */
export function isVmIdInScope(id: number, scope: string): boolean {
  if (scope === "global") return id >= 1000 && id < 1500;
  if (scope === "regional") return id >= 100000 && id < 10000000;
  if (scope === "zonal") return id >= 100000 && id < 10000000;
  return false;
}

/** Step size between role offsets (max instances per role) */
export const ROLE_OFFSET_STEP = 50;

// ════════════════════════════════════════════════════════════════════════════
// REQUIRED WORKLOADS BY TIER
// ════════════════════════════════════════════════════════════════════════════

export interface RequiredWorkloads {
  global: string[]; // required global file basenames (without .yaml)
  regional: string[]; // required regional file basenames
  zonalZone: string[]; // required per-zone file basenames
  zonalHub: string[]; // required per-hub file basenames
}

export const REQUIRED_WORKLOADS: Record<string, RequiredWorkloads> = {
  local: {
    global: ["database", "secrets"],
    regional: ["monitoring"],
    zonalZone: ["firewall", "loadbalancer"],
    zonalHub: [],
  },
  production: {
    global: ["database", "dns", "secrets", "identity", "mesh"],
    regional: ["monitoring", "bastion", "siem"],
    zonalZone: ["firewall", "loadbalancer"],
    zonalHub: ["storage", "backup"],
  },
  enterprise: {
    global: ["database", "dns", "secrets", "identity", "mesh"],
    regional: ["monitoring", "bastion", "siem"],
    zonalZone: ["firewall", "loadbalancer"],
    zonalHub: ["storage", "backup"],
  },
};

// ════════════════════════════════════════════════════════════════════════════
// VALID VALUES
// ════════════════════════════════════════════════════════════════════════════

import { ImplementationMap, VERSION_CATALOG } from "../../commands/init/types";

export const VALID_TIERS = ["local", "production", "enterprise"];
export const VALID_COMPLIANCE = ["startup", "business", "enterprise", "regulated"];
export const VALID_STATE_BACKENDS = ["local", "remote"];
export const VALID_NODE_ROLES = ["primary", "secondary"];
export const VALID_NODE_CAPABILITIES = ["compute", "nvme", "ceph", "hdd", "backup", "gpu"];
export const VALID_CREDENTIAL_TYPES = ["env", "vault", "file"];

export const REQUIRED_ZONE_VLANS = [
  "management",
  "corosync",
  "vm-network",
  "ceph-public",
  "ceph-cluster",
  "backup",
];
export const REQUIRED_HUB_VLANS = ["management", "corosync", "backup"];

/** All valid roles per scope */
export const VALID_ROLES: Record<string, string[]> = {
  global: ["database", "dns-authoritative", "dns-loadbalancer", "secrets", "identity", "mesh"],
  regional: ["metrics", "logs", "alerting", "dashboards", "bastion", "siem"],
  zonal: ["firewall", "loadbalancer", "storage", "backup"],
};

/** Valid implementations per role (from ImplementationMap type) */
export const VALID_IMPLEMENTATIONS: Record<string, string[]> = {
  database: ["postgresql", "mysql", "mariadb"],
  secrets: ["vault", "infisical", "openbao"],
  identity: ["keycloak", "authentik", "zitadel"],
  "dns-authoritative": ["powerdns", "bind", "knot"],
  "dns-loadbalancer": ["dnsdist", "haproxy"],
  metrics: ["prometheus", "victoriametrics", "mimir"],
  logs: ["loki", "elasticsearch", "graylog"],
  alerting: ["alertmanager", "grafana-alerting"],
  dashboards: ["grafana", "kibana"],
  bastion: ["teleport", "boundary", "guacamole"],
  siem: ["wazuh", "elastic-siem", "splunk"],
  firewall: ["vyos", "opnsense", "pfsense"],
  loadbalancer: ["haproxy", "nginx", "traefik"],
  storage: ["minio", "ceph-rgw", "seaweedfs"],
  backup: ["pbs", "restic", "borg"],
  mesh: ["headscale", "netbird"],
};

/** Roles where zone workloads are valid vs hub workloads */
export const ZONE_ROLES = ["firewall", "loadbalancer"];
export const HUB_ROLES = ["storage", "backup"];
