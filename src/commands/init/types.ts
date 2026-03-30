/**
 * Soverstack Init - Types
 *
 * New structure: inventory/ + workloads/
 */

import { InfrastructureTierType, ComplianceLevel } from "@/types";

// ════════════════════════════════════════════════════════════════════════════
// REGION & DATACENTER
// ════════════════════════════════════════════════════════════════════════════

/**
 * Datacenter type
 */
export type DatacenterType = "hub" | "zone";

/**
 * Datacenter configuration (for generators)
 */
export interface DatacenterConfig {
  name: string;
  type: DatacenterType;
  fullName: string; // e.g., "hub-frankfurt" or "zone-paris"
}

/**
 * Region configuration with datacenters (for generators)
 */
export interface RegionConfig {
  name: string;
  zones: string[];
  hub?: string; // Hub name (optional, defaults to "hub-{region}")
}

// ════════════════════════════════════════════════════════════════════════════
// UNIFIED INVENTORY (parsed from files)
// ════════════════════════════════════════════════════════════════════════════

/**
 * Node in a datacenter (from nodes.yaml)
 */
export interface InventoryNode {
  name: string;
  address: string;
  role: "primary" | "secondary";
  capabilities: string[];
  bootstrap?: {
    user: string;
    port: number;
    password: {
      type: "env" | "vault" | "file";
      var_name?: string;
      path?: string;
    };
  };
}

/**
 * Ceph configuration (from nodes.yaml)
 */
export interface InventoryCeph {
  enabled: boolean;
  pool_name?: string;
}

/**
 * VLAN configuration (from network.yaml)
 */
export interface InventoryVlan {
  id: number;
  name: string;
  subnet: string;
  gateway?: string;
  mesh: boolean;
  mtu: number;
}

/**
 * Public IPs configuration (from network.yaml)
 */
export interface InventoryPublicIps {
  type: "allocated_block" | "bgp";
  allocated_block?: {
    block: string;
    gateway: string;
    usable_range: string;
  };
  bgp?: {
    asn: number;
    upstream_asn: number;
    ip_blocks: string[];
  };
}

/**
 * SSH user (from ssh.yaml)
 */
export interface InventorySshUser {
  user: string;
  groups: string[];
  shell: string;
  public_key: {
    type: "file" | "env" | "vault";
    path?: string;
    var_name?: string;
  };
  private_key: {
    type: "file" | "env" | "vault";
    path?: string;
    var_name?: string;
  };
}

/**
 * Knockd configuration (from ssh.yaml)
 */
export interface InventoryKnockd {
  enabled: boolean;
  sequence: number[];
  seq_timeout: number;
  port_timeout: number;
}

/**
 * SSH rotation policy (from ssh.yaml)
 */
export interface InventoryRotationPolicy {
  max_age_days: number;
  warning_days: number;
}

/**
 * Unified Datacenter (discovered from filesystem + merged from nodes.yaml + network.yaml + ssh.yaml)
 * Type is derived from prefix: hub-* = hub, zone-* = zone
 */
export interface InventoryDatacenter {
  name: string;
  type: DatacenterType; // Derived from prefix

  // From nodes.yaml
  nodes: InventoryNode[];
  ceph?: InventoryCeph;

  // From network.yaml
  vlans: InventoryVlan[];
  public_ips?: InventoryPublicIps;

  // From ssh.yaml
  rotation_policy: InventoryRotationPolicy;
  knockd: InventoryKnockd;
  users: InventorySshUser[];
}

/**
 * Unified Region (from region.yaml + merged datacenters)
 */
export interface InventoryRegion {
  name: string;
  description: string;
  dns_zone: string;
  hub?: string;
  compliance: string[];
  datacenters: InventoryDatacenter[];
}

/**
 * Unified Inventory (all regions with merged data)
 */
export interface Inventory {
  regions: InventoryRegion[];
}

// ════════════════════════════════════════════════════════════════════════════
// INIT OPTIONS
// ════════════════════════════════════════════════════════════════════════════

/**
 * Main init options
 */
export interface InitOptions {
  projectName: string;
  domain: string;
  regions: RegionConfig[];
  primaryRegion: string;
  primaryZone: string;
  generateSshKeys: boolean;
  infrastructureTier: InfrastructureTierType;
  complianceLevel: ComplianceLevel;
  skipHubs?: boolean; // Skip hub generation (local tier)
}

/**
 * Context passed to generators
 */
export interface GeneratorContext {
  projectPath: string;
  options: InitOptions;
  /** 1-based region index map: regionName → regionId */
  regionIds: Map<string, number>;
  /** 1-based DC index map (per region): regionName → dcFullName → dcId */
  dcIds: Map<string, Map<string, number>>;
}

// ════════════════════════════════════════════════════════════════════════════
// FLAVOR (Instance Types)
// ════════════════════════════════════════════════════════════════════════════

/**
 * VM Flavor definition
 */
export interface Flavor {
  name: string;
  cpu: number;
  ram: number;
  disk: number;
}

/**
 * Default flavors
 */
export const DEFAULT_FLAVORS: Flavor[] = [
  { name: "micro", cpu: 1, ram: 1024, disk: 10 },
  { name: "small", cpu: 2, ram: 2048, disk: 20 },
  { name: "standard", cpu: 2, ram: 4096, disk: 32 },
  { name: "large", cpu: 4, ram: 8192, disk: 64 },
  { name: "performance", cpu: 8, ram: 16384, disk: 100 },
];

// ════════════════════════════════════════════════════════════════════════════
// NETWORK TYPES
// ════════════════════════════════════════════════════════════════════════════

/**
 * VLAN configuration
 */
export interface VlanConfig {
  id: number;
  name: string;
  subnet: string;
  gateway?: string; // Only for mesh: true VLANs
  mesh: boolean;
  mtu: number;
}

/**
 * Public IPs configuration
 */
export interface PublicIpsConfig {
  type: "allocated_block" | "bgp";
  allocated_block?: {
    block: string;
    gateway: string;
    usable_range: string;
  };
  bgp?: {
    asn: number;
    upstream_asn: number;
    ip_blocks: string[];
  };
}

/**
 * Default VLANs for zones (with Ceph)
 */
export const DEFAULT_ZONE_VLANS: VlanConfig[] = [
  { id: 10, name: "management", subnet: "", gateway: "", mesh: true, mtu: 1500 },
  { id: 11, name: "corosync", subnet: "", mesh: false, mtu: 9000 },
  { id: 20, name: "vm-network", subnet: "", gateway: "", mesh: true, mtu: 1500 },
  { id: 30, name: "ceph-public", subnet: "", mesh: false, mtu: 9000 },
  { id: 31, name: "ceph-cluster", subnet: "", mesh: false, mtu: 9000 },
  { id: 40, name: "backup", subnet: "", gateway: "", mesh: true, mtu: 1500 },
];

/**
 * Default VLANs for hubs (no Ceph, no VMs)
 */
export const DEFAULT_HUB_VLANS: VlanConfig[] = [
  { id: 10, name: "management", subnet: "", gateway: "", mesh: true, mtu: 1500 },
  { id: 11, name: "corosync", subnet: "", mesh: false, mtu: 9000 },
  { id: 40, name: "backup", subnet: "", gateway: "", mesh: true, mtu: 1500 },
];

// ════════════════════════════════════════════════════════════════════════════
// WORKLOAD TYPES
// ════════════════════════════════════════════════════════════════════════════

/**
 * Workload scope
 */
export type WorkloadScope = "global" | "regional" | "zonal";

// ────────────────────────────────────────────────────────────────────────────
// SERVICE ROLES
// ────────────────────────────────────────────────────────────────────────────

/**
 * Global service roles
 */
export type GlobalServiceRole =
  | "database"
  | "secrets"
  | "identity"
  | "dns-authoritative"
  | "dns-loadbalancer";

/**
 * Regional service roles
 */
export type RegionalServiceRole =
  | "metrics"
  | "logs"
  | "alerting"
  | "dashboards"
  | "bastion"
  | "siem";

/**
 * Zonal service roles
 */
export type ZonalServiceRole = "firewall" | "loadbalancer" | "storage" | "backup";

/**
 * All service roles
 */
export type ServiceRole = GlobalServiceRole | RegionalServiceRole | ZonalServiceRole;

// ────────────────────────────────────────────────────────────────────────────
// IMPLEMENTATIONS
// ────────────────────────────────────────────────────────────────────────────

/**
 * Implementation options per role
 */
export type ImplementationMap = {
  // Global
  database: "postgresql" | "mysql" | "mariadb";
  secrets: "vault" | "infisical" | "openbao";
  identity: "keycloak" | "authentik" | "zitadel";
  "dns-authoritative": "powerdns" | "bind" | "knot";
  "dns-loadbalancer": "dnsdist" | "haproxy";
  mesh: "headscale" | "netbird";
  // Regional
  metrics: "prometheus" | "victoriametrics" | "mimir";
  logs: "loki" | "elasticsearch" | "graylog";
  alerting: "alertmanager" | "grafana-alerting";
  dashboards: "grafana" | "kibana";
  bastion: "teleport" | "boundary" | "guacamole";
  siem: "wazuh" | "elastic-siem" | "splunk";
  // Zonal
  firewall: "vyos" | "opnsense" | "pfsense";
  loadbalancer: "haproxy" | "nginx" | "traefik";
  storage: "minio" | "ceph-rgw" | "seaweedfs";
  backup: "pbs" | "restic" | "borg";
};

/**
 * Runtime map: all implementations per role (used by generators and validators)
 */
export const IMPLEMENTATIONS: Record<string, string[]> = {
  database: ["postgresql", "mysql", "mariadb"],
  secrets: ["vault", "infisical", "openbao"],
  identity: ["keycloak", "authentik", "zitadel"],
  "dns-authoritative": ["powerdns", "bind", "knot"],
  "dns-loadbalancer": ["dnsdist", "haproxy"],
  mesh: ["headscale", "netbird"],
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
};

/**
 * Default implementation per role (first in the list = recommended)
 */
export const DEFAULT_IMPLEMENTATIONS: Record<string, string> = {
  database: "postgresql",
  secrets: "openbao",
  identity: "keycloak",
  "dns-authoritative": "powerdns",
  "dns-loadbalancer": "dnsdist",
  mesh: "headscale",
  metrics: "prometheus",
  logs: "loki",
  alerting: "alertmanager",
  dashboards: "grafana",
  bastion: "teleport",
  siem: "wazuh",
  firewall: "vyos",
  loadbalancer: "haproxy",
  storage: "minio",
  backup: "pbs",
};

/**
 * Generate YAML implementation line with alternatives as comment
 * Example: implementation: postgresql    # postgresql | mysql | mariadb
 */
export function implLine(role: string, indent: number = 4): string {
  const impl = DEFAULT_IMPLEMENTATIONS[role] || "unknown";
  const all = IMPLEMENTATIONS[role] || [impl];
  const pad = " ".repeat(indent);
  const alternatives = all.join(" | ");
  return `${pad}implementation: ${impl}${" ".repeat(Math.max(1, 14 - impl.length))}# ${alternatives}`;
}

// ────────────────────────────────────────────────────────────────────────────
// SERVICE INSTANCE
// ────────────────────────────────────────────────────────────────────────────

/**
 * Service instance (VM)
 */
export interface ServiceInstance {
  name: string;
  vm_id: number;
  flavor: string;
  disk?: number; // Override flavor disk (in GB)
  image: string;
  host: string;
}

// ────────────────────────────────────────────────────────────────────────────
// SERVICE DEFINITIONS
// ────────────────────────────────────────────────────────────────────────────

/**
 * Base service properties
 */
interface BaseService<R extends ServiceRole> {
  role: R;
  implementation: ImplementationMap[R];
  version: string;
  instances: ServiceInstance[];
  overwrite_config?: Record<string, unknown>;
}

/**
 * Global service (no region/datacenter)
 */
export interface GlobalService<
  R extends GlobalServiceRole = GlobalServiceRole,
> extends BaseService<R> {
  scope: "global";
}

/**
 * Regional service (has region)
 */
export interface RegionalService<
  R extends RegionalServiceRole = RegionalServiceRole,
> extends BaseService<R> {
  scope: "regional";
  region: string;
}

/**
 * Zonal service (has region + datacenter)
 */
export interface ZonalService<
  R extends ZonalServiceRole = ZonalServiceRole,
> extends BaseService<R> {
  scope: "zonal";
  region: string;
  datacenter: string;
}

/**
 * Any workload service
 */
export type WorkloadService = GlobalService | RegionalService | ZonalService;

// ────────────────────────────────────────────────────────────────────────────
// WORKLOAD FILE
// ────────────────────────────────────────────────────────────────────────────

/**
 * Workload file structure
 */
export interface WorkloadFile {
  services: WorkloadService[];
}

// ────────────────────────────────────────────────────────────────────────────
// VERSION CATALOG
// ────────────────────────────────────────────────────────────────────────────

/**
 * Version info for an implementation
 */
export interface VersionInfo {
  current: string;
  supported: string[];
}

/**
 * Version catalog - latest versions for each implementation
 */
export const VERSION_CATALOG: Record<string, VersionInfo> = {
  // Database
  postgresql: { current: "16", supported: ["16", "15", "14"] },
  mysql: { current: "8.4", supported: ["8.4", "8.0"] },
  mariadb: { current: "11.4", supported: ["11.4", "11.2", "10.11"] },
  // Secrets
  vault: { current: "1.17", supported: ["1.17", "1.16", "1.15"] },
  infisical: { current: "0.80", supported: ["0.80", "0.79"] },
  // Identity
  keycloak: { current: "25", supported: ["25", "24", "23"] },
  authentik: { current: "2024.6", supported: ["2024.6", "2024.4", "2024.2"] },
  zitadel: { current: "2.54", supported: ["2.54", "2.53", "2.52"] },
  // DNS
  powerdns: { current: "4.9", supported: ["4.9", "4.8", "4.7"] },
  bind: { current: "9.20", supported: ["9.20", "9.18"] },
  knot: { current: "3.3", supported: ["3.3", "3.2"] },
  dnsdist: { current: "1.9", supported: ["1.9", "1.8", "1.7"] },
  // Metrics
  prometheus: { current: "2.53", supported: ["2.53", "2.52", "2.51"] },
  victoriametrics: { current: "1.101", supported: ["1.101", "1.102", "1.100", "1.99"] },
  mimir: { current: "2.13", supported: ["2.13", "2.12", "2.11"] },
  // Logs
  loki: { current: "3.1", supported: ["3.1", "3.0", "2.9"] },
  elasticsearch: { current: "8.14", supported: ["8.14", "8.13", "8.12"] },
  graylog: { current: "6.0", supported: ["6.0", "5.2", "5.1"] },
  // Alerting
  alertmanager: { current: "0.27", supported: ["0.27", "0.26", "0.25"] },
  "grafana-alerting": { current: "11.1", supported: ["11.1", "11.0", "10.4"] },
  // Dashboards
  grafana: { current: "11.1", supported: ["11.1", "11.0", "10.4"] },
  kibana: { current: "8.14", supported: ["8.14", "8.13", "8.12"] },
  // Bastion
  teleport: { current: "16", supported: ["16", "15", "14"] },
  boundary: { current: "0.16", supported: ["0.16", "0.15", "0.14"] },
  guacamole: { current: "1.5", supported: ["1.5", "1.4"] },
  // SIEM
  wazuh: { current: "4.8", supported: ["4.8", "4.7"] },
  "elastic-siem": { current: "8.14", supported: ["8.14", "8.13", "8.12"] },
  splunk: { current: "9.2", supported: ["9.2", "9.1", "9.0"] },
  // Firewall
  vyos: { current: "1.4", supported: ["1.4", "1.3"] },
  opnsense: { current: "24.7", supported: ["24.7", "24.1", "23.7"] },
  pfsense: { current: "2.7", supported: ["2.7", "2.6"] },
  // Loadbalancer
  haproxy: { current: "3.0", supported: ["3.0", "2.9", "2.8"] },
  nginx: { current: "1.27", supported: ["1.27", "1.26", "1.25"] },
  traefik: { current: "3.1", supported: ["3.1", "3.0", "2.11"] },
  // Storage
  minio: { current: "2024.07", supported: ["2024.07", "2024.06", "2024.01"] },
  "ceph-rgw": { current: "18.2", supported: ["18.2", "17.2"] },
  seaweedfs: { current: "3.69", supported: ["3.69", "3.68", "3.67"] },
  // Backup
  pbs: { current: "3.2", supported: ["3.2", "3.1", "3.0"] },
  restic: { current: "0.16", supported: ["0.16", "0.15"] },
  borg: { current: "1.4", supported: ["1.4", "1.2"] },
};

/**
 * Get version info for an implementation
 */
export function getVersionInfo(implementation: string): VersionInfo {
  return VERSION_CATALOG[implementation] || { current: "latest", supported: ["latest"] };
}

/**
 * Generate YAML version line with supported versions as comment
 * Example: version: "16"               # Supported: 16, 15, 14
 */
export function versionLine(implementation: string, indent: number = 4): string {
  const info = getVersionInfo(implementation);
  const pad = " ".repeat(indent);
  return `${pad}version: "${info.current}"${" ".repeat(Math.max(1, 16 - info.current.length))}# Supported: ${info.supported.join(", ")}`;
}

// ════════════════════════════════════════════════════════════════════════════
// VM ID SCHEME
// ════════════════════════════════════════════════════════════════════════════
//
// vm_id = SCOPE_BASE + regionId × 100000 + dcId × 1000 + ROLE_OFFSET + instance
//
// Structure:  [Region][DC][Role+Instance]
//
//   GLOBAL:    1000 + roleOffset + instance            (fixed, one set)
//   REGIONAL:  regionId × 100000 + roleOffset + inst   (dcId = 0)
//   ZONAL:     regionId × 100000 + dcId × 1000 + roleOffset + inst
//
// regionId: 1-based (eu=1, us=2, asia=3...)
// dcId:     0 = regional, 1+ = datacenters (hubs first, then zones)
//
// Reading a VM ID:
//   102051 → region 1 (eu), dc 02 (zone-paris), offset 50 (loadbalancer), instance 1
//   200050 → region 2 (asia), dc 00 (regional), offset 50 (logs), instance 0
//   1201   → global, offset 200 (database), instance 1
//
// ════════════════════════════════════════════════════════════════════════════

/** Base for global scope (no region/dc encoding) */
export const GLOBAL_BASE = 1000;

/** Multiplier per region */
export const REGION_BLOCK = 100000;

/** Multiplier per datacenter within a region */
export const DC_BLOCK = 1000;

/**
 * Role offsets within a location block (step of 50)
 * Each role gets 50 VM IDs (instances 0-49)
 */
export const ROLE_OFFSETS = {
  // Global roles (used with GLOBAL_BASE)
  "dns-authoritative": 0,
  "dns-loadbalancer": 50,
  secrets: 100,
  identity: 150,
  database: 200,
  mesh: 250,

  // Regional roles (used with regionId × REGION_BLOCK, dcId = 0)
  metrics: 0,
  logs: 50,
  alerting: 100,
  dashboards: 150,
  bastion: 200,
  siem: 250,

  // Zonal roles (used with regionId × REGION_BLOCK + dcId × DC_BLOCK)
  firewall: 0,
  loadbalancer: 50,
  storage: 0, // hub: same offset as firewall (different DC)
  backup: 50, // hub: same offset as loadbalancer (different DC)
} as const;

/**
 * Compute a VM ID from the hierarchical scheme.
 *
 * @param scope - "global" | "regional" | "zonal"
 * @param regionId - 1-based region index (ignored for global)
 * @param dcId - 0 for regional, 1+ for zonal DCs (ignored for global)
 * @param role - service role name
 * @param instance - 0-based instance index
 */
export function vmId(
  scope: "global" | "regional" | "zonal",
  regionId: number,
  dcId: number,
  role: string,
  instance: number,
): number {
  const offset = ROLE_OFFSETS[role as keyof typeof ROLE_OFFSETS] ?? 0;

  if (scope === "global") {
    return GLOBAL_BASE + offset + instance;
  }
  return regionId * REGION_BLOCK + dcId * DC_BLOCK + offset + instance;
}

// ════════════════════════════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════════════════════════════

/**
 * Get primary region config
 */
export function getPrimaryRegion(options: InitOptions): RegionConfig {
  const found = options.regions.find((r) => r.name === options.primaryRegion);
  return found || options.regions[0];
}

/**
 * Get primary zone name
 */
export function getPrimaryZone(options: InitOptions): string {
  return options.primaryZone || getPrimaryRegion(options).zones[0] || "main";
}

/**
 * Get hub name for a region
 */
export function getHubName(region: RegionConfig): string {
  return region.hub || `hub-${region.name}`;
}

/**
 * Get zone full name (e.g., "zone-paris")
 */
export function getZoneFullName(zoneName: string): string {
  return `zone-${zoneName}`;
}

/**
 * Check if a region owns its hub (vs using a shared hub from another region)
 */
export function regionOwnsHub(region: RegionConfig): boolean {
  return !region.hub || region.hub === `hub-${region.name}`;
}

/**
 * Get all datacenters for a region
 * @param region - Region configuration
 * @param includeHub - Whether to include hub (default: true, false for local tier)
 */
export function getDatacenters(
  region: RegionConfig,
  includeHub: boolean = true,
): DatacenterConfig[] {
  const datacenters: DatacenterConfig[] = [];

  // Add hub (unless skipHubs for local tier)
  if (includeHub) {
    const hubName = getHubName(region);
    datacenters.push({
      name: "hub",
      type: "hub",
      fullName: hubName,
    });
  }

  // Add zones
  region.zones.forEach((zone) => {
    datacenters.push({
      name: zone,
      type: "zone",
      fullName: getZoneFullName(zone),
    });
  });

  return datacenters;
}
