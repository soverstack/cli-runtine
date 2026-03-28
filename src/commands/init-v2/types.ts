/**
 * Soverstack Init V2 - Types
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
 * Datacenter entry in region.yaml
 */
export interface InventoryDatacenterRef {
  name: string;
  type: DatacenterType;
  description: string;
  control_plane?: boolean;
  path: string;
}

/**
 * Unified Datacenter (merged from region.yaml + nodes.yaml + network.yaml + ssh.yaml)
 */
export interface InventoryDatacenter {
  // From region.yaml (datacenter entry)
  name: string;
  type: DatacenterType;
  description: string;
  control_plane?: boolean;

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
  disk: string;
}

/**
 * Default flavors
 */
export const DEFAULT_FLAVORS: Flavor[] = [
  { name: "micro", cpu: 1, ram: 1024, disk: "10G" },
  { name: "small", cpu: 2, ram: 2048, disk: "20G" },
  { name: "standard", cpu: 2, ram: 4096, disk: "32G" },
  { name: "large", cpu: 4, ram: 8192, disk: "64G" },
  { name: "performance", cpu: 8, ram: 16384, disk: "100G" },
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
export type ZonalServiceRole =
  | "firewall"
  | "loadbalancer"
  | "storage"
  | "backup";

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
  secrets: "vault" | "infisical";
  identity: "keycloak" | "authentik" | "zitadel";
  "dns-authoritative": "powerdns" | "bind" | "knot";
  "dns-loadbalancer": "dnsdist" | "haproxy";
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
export interface GlobalService<R extends GlobalServiceRole = GlobalServiceRole> extends BaseService<R> {
  scope: "global";
}

/**
 * Regional service (has region)
 */
export interface RegionalService<R extends RegionalServiceRole = RegionalServiceRole> extends BaseService<R> {
  scope: "regional";
  region: string;
}

/**
 * Zonal service (has region + datacenter)
 */
export interface ZonalService<R extends ZonalServiceRole = ZonalServiceRole> extends BaseService<R> {
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
  victoriametrics: { current: "1.101", supported: ["1.101", "1.100", "1.99"] },
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
 * Get all datacenters for a region
 * @param region - Region configuration
 * @param includeHub - Whether to include hub (default: true, false for local tier)
 */
export function getDatacenters(region: RegionConfig, includeHub: boolean = true): DatacenterConfig[] {
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
