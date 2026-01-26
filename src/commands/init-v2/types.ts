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
 * Datacenter configuration
 */
export interface DatacenterConfig {
  name: string;
  type: DatacenterType;
  fullName: string; // e.g., "hub-frankfurt" or "zone-paris"
}

/**
 * Region configuration with datacenters
 */
export interface RegionConfig {
  name: string;
  zones: string[];
  hub?: string; // Hub name (optional, defaults to "hub-{region}")
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

/**
 * Service definition in a workload file
 */
export interface ServiceDefinition {
  name: string;
  vm_id: number;
  flavor: string;
  image: string;
  host?: string;
  scheduling?: {
    strategy: "manual" | "auto";
    host?: string;
  };
  network?: {
    bridge: string;
    vlan: string;
  };
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
