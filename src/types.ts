// ═══════════════════════════════════════════════════════════════════════════
// SOVERSTACK RUNTIME - TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════
//
// SECURITY:
// - NEVER store passwords in plain text - use CredentialRef
// - NEVER store SSH private keys in git - use CredentialRef
// - ALWAYS use environment variables or Vault via CredentialRef
//
// Convention: snake_case for properties, PascalCase for interfaces
//
// ═══════════════════════════════════════════════════════════════════════════

// ───────────────────────────────────────────────────────────────────────────
// ENUMS & LITERAL TYPES
// ───────────────────────────────────────────────────────────────────────────

export type InfrastructureTierType = "local" | "production" | "enterprise";
export type BackendType = "local" | "aws" | "gcr" | "azure";

// ───────────────────────────────────────────────────────────────────────────
// COMPLIANCE LEVELS
// ───────────────────────────────────────────────────────────────────────────
// Based on compliance level, certain security and HA choices are automatic.
// Not all projects need enterprise-grade security - choose what fits your needs.

export type ComplianceLevel = "startup" | "business" | "enterprise" | "regulated";

export type RegulationType =
  | "pci-dss"   // Payment Card Industry
  | "soc2"     // Cloud Security
  | "hds"      // Healthcare Data (France)
  | "gdpr"     // Personal Data (EU)
  | "iso27001" // Information Security
  | "hipaa";   // Healthcare (US)

export type PossibleOSTemplates =
  | "debian-12-cloudinit"
  | "ubuntu-20.04-cloudinit"
  | "ubuntu-24.04-cloudinit";

export type VMRole =
  // EDGE & NETWORK
  | "firewall"
  | "dns_lb"
  | "dns_server"
  | "load_balancer"
  // ZERO-TRUST & SECURITY
  | "bastion"           // Headscale VPN
  | "ssh_bastion"       // Teleport SSH
  | "secrets"           // OpenBao/Vault
  | "iam_sso"           // Keycloak
  | "ids"               // CrowdSec
  // DATA
  | "database"          // PostgreSQL
  | "cache"             // Redis
  // OBSERVABILITY
  | "monitoring"        // Prometheus
  | "alerting"          // Alertmanager
  | "dashboards"        // Grafana
  | "logging"           // Loki
  | "siem"              // Wazuh, Falco
  | "status_page"       // Uptime Kuma
  // BACKUP (Hub)
  | "backup_server"     // PBS
  | "object_storage"    // MinIO
  // KUBERNETES
  | "k8s_master"
  | "k8s_worker"
  // TOOLS
  | "pentest"
  | "management"        // Soverstack orchestrator
  | "ci_runner"
  | "git_server"        // Gitea
  | "registry"          // Harbor
  // OTHER
  | "general_purpose"
  | "template";

export type LayerType =
  | "datacenter"
  | "compute"
  | "cluster"
  | "database"
  | "networking"
  | "security"
  | "observability"
  | "apps"
  | "region"
  | "hub"
  | "zone"
  | "backup";

export type UserGroupType = "sudo" | "docker" | "kvm" | "systemd-journal" | "adm";

// ───────────────────────────────────────────────────────────────────────────
// CREDENTIAL REFERENCE - For secrets management (use everywhere!)
// ───────────────────────────────────────────────────────────────────────────

export type CredentialRef =
  | { type: "vault"; path: string }
  | { type: "env"; var_name: string }
  | { type: "file"; path: string };

// ───────────────────────────────────────────────────────────────────────────
// PLATFORM - Root configuration
// ───────────────────────────────────────────────────────────────────────────

/**
 * Layer paths configuration (legacy single-DC mode)
 * All paths are relative to the datacenter directory
 */
export interface LayerPaths {
  datacenter: string;
  compute: string;
  database?: string;
  k8s?: string;
  networking?: string;
  security?: string;
  observability?: string;
  apps?: string;
}

/**
 * Datacenter configuration in multi-DC mode (legacy)
 * Path is NOT stored - it's derived from name: ./datacenters/{name}/
 */
export interface DatacenterEntry {
  name: string;
  primary?: boolean; // First one is primary by default
  layers: LayerPaths;
  ssh?: string;
}

// ───────────────────────────────────────────────────────────────────────────
// NEW STRUCTURE: REGIONS / HUB / ZONES
// ───────────────────────────────────────────────────────────────────────────

/**
 * Control plane location - where global VMs and databases run
 */
export interface ControlPlaneLocation {
  region: string;
  zone: string;
}

/**
 * Region reference in platform.yaml
 */
export interface RegionRef {
  name: string;
  path: string;  // e.g., "./regions/eu/region.yaml"
}

/**
 * Hub configuration (backup infrastructure)
 * Contains PBS (Proxmox Backup Server) and MinIO for backups
 */
export interface HubConfig {
  name: string;
  path?: string;  // e.g., "./hub/cluster.yaml"
  backup?: BackupConfig;
  compute?: string;  // VMs for PBS, MinIO
}

/**
 * Zone configuration (production Proxmox cluster)
 */
export interface ZoneConfig {
  name: string;
  path?: string;  // e.g., "./zones/main/datacenter.yaml"
  datacenter?: string;
  networking?: string;
  compute?: string;
}

/**
 * Region configuration
 * Contains: services config + hub (backup) + zones (production)
 */
export interface RegionConfig {
  name: string;
  deployed_on: string;  // Zone name where regional VMs are deployed

  // Regional configs
  observability?: string;
  compute?: string;  // Regional VMs (Prometheus, Loki, etc.)

  // Hub (backup infrastructure)
  hub?: HubConfig;

  // Zones (production Proxmox clusters)
  zones: ZoneConfig[];
}

/**
 * Backup configuration
 */
export interface BackupConfig {
  pbs?: {
    enabled: boolean;
    vm_ids?: number[];
    schedule: string;  // e.g., "0 */30 * * * *" (every 30min)
    retention: {
      hourly: number;
      daily: number;
      weekly: number;
      monthly: number;
    };
  };
  minio?: {
    enabled: boolean;
    vm_ids?: number[];
    bucket_prefix?: string;
  };
}

/**
 * Compliance configuration
 */
export interface ComplianceConfig {
  level: ComplianceLevel;
  regulations?: RegulationType[];
}

/**
 * Platform configuration (NEW structure with regions)
 *
 * Structure:
 *   platform.yaml             <- Root config
 *   ├── orchestrator.yaml     # Global: API, PDM, Gitea, Harbor
 *   ├── security.yaml         # Global: Vault, Keycloak, Teleport
 *   ├── networking.yaml       # Global: Headscale, PowerDNS
 *   ├── observability.yaml    # Global: Grafana, Uptime Kuma
 *   ├── core-compute.yaml     # Global VMs
 *   ├── core-database.yaml    # Global DB (PostgreSQL)
 *   └── regions/
 *       └── {region}/
 *           ├── region.yaml
 *           ├── core-compute.yaml  # Regional VMs (Prometheus, Loki)
 *           ├── hub/               # Backup infrastructure
 *           └── zones/{zone}/      # Production clusters
 */
export interface Platform {
  project_name: string;
  version: string;
  domain: string;
  environment?: string;
  infrastructure_tier: InfrastructureTierType;

  // Compliance
  compliance?: ComplianceConfig;

  // ════════════════════════════════════════════════════════════════════════
  // GLOBAL SERVICES (unique across all regions)
  // VMs/DBs deployed on control_plane_runs_on zone
  // ════════════════════════════════════════════════════════════════════════
  orchestrator?: string;    // ./orchestrator.yaml
  security?: string;        // ./security.yaml
  networking?: string;      // ./networking.yaml
  observability?: string;   // ./observability.yaml
  compute?: string;         // ./core-compute.yaml (global VMs)
  database?: string;        // ./core-database.yaml (global DB)
  ssh?: string;             // ./ssh_config.yaml

  // Where global VMs and databases run
  control_plane_runs_on?: ControlPlaneLocation;

  // ════════════════════════════════════════════════════════════════════════
  // REGIONS (new structure)
  // ════════════════════════════════════════════════════════════════════════
  regions?: RegionRef[];

  // ════════════════════════════════════════════════════════════════════════
  // LEGACY: Single DC mode / Multi-DC mode
  // ════════════════════════════════════════════════════════════════════════
  layers?: LayerPaths;
  datacenters?: DatacenterEntry[];

  // State management
  state: {
    backend: BackendType;
    path: string;
  };
}

// ───────────────────────────────────────────────────────────────────────────
// DATACENTER - Physical servers configuration
// ───────────────────────────────────────────────────────────────────────────

/**
 * Soverstack runtime configuration - where CLI/orchestration runs
 */
export interface SoverstackConfig {
  vm_id: number; // VM ID for Soverstack runtime (TOOLS range: 400-499)
}

/**
 * Proxmox Datacenter Manager - only for multi-DC setups (2+ datacenters)
 * Manages multiple Proxmox clusters from a central location
 */
export interface DatacenterManagerConfig {
  enabled: boolean;
  vm_id: number; // VM ID for Proxmox Datacenter Manager
}

export interface Datacenter {
  name: string;
  location?: string;
  servers: ServerType[];
  backup_servers?: ServerType[];
  storage_backends?: Record<string, StorageBackend>;

  // Soverstack runtime VM in this datacenter
  soverstack?: SoverstackConfig;

  // Proxmox Datacenter Manager (only for multi-DC, 2+ datacenters)
  datacenter_manager?: DatacenterManagerConfig;
}

export interface ServerType {
  name: string;
  id: number;
  ip: string;
  port: number;
  password: CredentialRef;
  is_gpu_server?: boolean;
  os: "ubuntu" | "debian" | "rescue" | "proxmox";
  description?: ServerDescriptionType;
  disk_encryption: {
    enabled: boolean;
    password: CredentialRef;
  };
}

export interface ServerDescriptionType {
  cpu: number;
  cores: number;
  disks?: ServerDescriptionDiskType[];
}

export interface ServerDescriptionDiskType {
  type: "ssd" | "hdd" | "nvme" | "sata" | "sas" | "scsi" | "ide";
  size: number;
}

export interface StorageBackend {
  server: string;
  type: "s3";
  endpoint?: string;
  bucket_prefix?: string;
}

// ───────────────────────────────────────────────────────────────────────────
// COMPUTE - VMs and containers configuration
// ───────────────────────────────────────────────────────────────────────────

export interface ComputeConfig {
  instance_type_definitions?: ComputeType[];
  virtual_machines: (VMBasedOnType | VMCustom)[];
  linux_containers?: VMCustom[];
}

export interface ComputeType {
  name: string;
  cpu: number;
  ram: number;
  disk: number;
  os_template: PossibleOSTemplates | string;
  disk_type: "distributed" | "local";
  is_gpu_enabled?: boolean;
}

export interface VMBase {
  name: string;
  vm_id: number;
  host: string;
  role: VMRole;
  public_ip?: string;
  status?: "running" | "stopped" | "provisioning";
}

export interface VMBasedOnType extends VMBase {
  type_definition: string;
}

export interface VMCustom extends VMBase {
  cpu: number;
  ram: number;
  disk: number;
  disk_type: "distributed" | "local";
  os_template: string;
}

// ───────────────────────────────────────────────────────────────────────────
// DATABASE - PostgreSQL clusters configuration
// ───────────────────────────────────────────────────────────────────────────

export interface DatabasesLayer {
  clusters: DatabaseCluster[];
}

export interface DatabaseCluster {
  name: string; // Unique identifier for this cluster (e.g., "main-cluster", "analytics-db")
  type: "postgresql";
  version: "14" | "15" | "16";
  cluster: {
    name: string; // Patroni cluster name
    ha: boolean;
    vm_ids: number[];
    read_replicas_vm_ids?: number[];
  };
  port?: number;
  ssl: "required" | "preferred" | "disabled";
  databases: DatabaseDefinition[];
  credentials: CredentialRef;
  backup?: DatabaseBackupConfig;
}

export interface DatabaseDefinition {
  name: string;
  owner: string;
}

export interface DatabaseBackupConfig {
  storage_backend: string;
  schedule: string;
  retention: {
    daily: number;
    weekly: number;
    monthly: number;
  };
  type: "pg_dumpall" | "wal_archive";
}

// ───────────────────────────────────────────────────────────────────────────
// NETWORKING - Public IP, DNS, VPN, Firewall
// ───────────────────────────────────────────────────────────────────────────

export interface NetworkingConfig {
  public_ip?: PublicIPConfig;
  dns?: DNSConfig;
  vpn?: VPNConfig;
  firewall?: FirewallConfig;
}

export type PublicIPConfigType = "allocated_block" | "bgp";

export interface PublicIPConfig {
  type: PublicIPConfigType;
  allocated_block?: {
    block: string;
    gateway: string;
    usable_range: string;
  };
  failover?: {
    type: "vrrp";
    routers: {
      name: string;
      vm_id: number;
      priority: number;
    }[];
    auth?: CredentialRef;
  };
  bgp?: {
    status: "coming_soon";
    asn?: number;
    ip_blocks?: string[];
  };
}

export interface FloatingIP {
  ip: string;
  vrrp_id: number;
  health_check?: {
    type: "tcp" | "http";
    port: number;
    path?: string;
    interval?: string;
  };
}

export interface DNSConfig {
  type: "powerdns" | "cloudflare" | "hybrid";
  deployment: "vm" | "cluster";
  powerdns?: {
    vm_ids: number[];
    loadbalancer_vm_ids?: number[];
    database: string;
  };
  cloudflare?: {
    mode: "proxy" | "dns_only";
    credentials: CredentialRef;
  };
  zones: DNSZone[];
}

export interface DNSZone {
  domain: string;
  type: "primary" | "secondary";
  internal?: boolean;
  nameservers?: string[];
  glue_records?: Record<string, string>;
}

export interface VPNConfig {
  enabled: boolean;
  type: "headscale" | "wireguard" | "netbird";
  deployment: "vm";
  vm_ids: number[];
  public_ip?: FloatingIP;
  database?: string;
  vpn_subnet?: string;
  oidc_enforced: true;
}

export interface FirewallConfig {
  enabled: boolean;
  type: "vyos" | "opnsense" | "pfsense";
  deployment: "vm";
  vm_ids: number[];
  public_ip?: FloatingIP;
  domain?: string;
}

// ───────────────────────────────────────────────────────────────────────────
// SECURITY - Vault, SSO (Keycloak/Authentik)
// ───────────────────────────────────────────────────────────────────────────

export interface SecurityConfig {
  vault?: VaultConfig;
  sso?: SSOConfig;
  teleport?: TeleportConfig;
  crowdsec?: CrowdSecConfig;
  cert_manager?: CertManagerConfig;
}

export interface TeleportConfig {
  enabled: boolean;
  deployment: "vm";
  vm_ids?: number[];
  subdomain?: string;
  accessible_outside_vpn?: boolean;
  database?: string;
}

export interface CrowdSecConfig {
  enabled: boolean;
  deployment: "vm";
  vm_ids?: number[];
  bouncers?: {
    traefik?: boolean;
    haproxy?: boolean;
    firewall?: boolean;
  };
}

export interface VaultConfig {
  enabled: boolean;
  deployment: "vm" | "cluster";
  vm_ids?: number[];
  replicas?: number;
  storage: "postgresql" | "raft";
  database?: string;
  subdomain?: string;
  accessible_outside_vpn?: boolean;
  backup?: {
    storage_backend: string;
    schedule: string;
    retention: {
      daily: number;
      weekly: number;
    };
  };
}

export interface SSOConfig {
  enabled: boolean;
  type: "keycloak" | "authentik";
  deployment: "vm" | "cluster";
  vm_ids?: number[];
  replicas?: number;
  database: string;
  subdomain?: string;
  accessible_outside_vpn?: boolean;
}

export interface CertManagerConfig {
  enabled: boolean;
  email: string;
  production: boolean;
}

// ───────────────────────────────────────────────────────────────────────────
// ORCHESTRATOR - API, PDM, Git, Registry
// ───────────────────────────────────────────────────────────────────────────

export interface OrchestratorConfig {
  soverstack?: {
    enabled: boolean;
    vm_ids?: number[];
    api_subdomain?: string;
    ui_subdomain?: string;
    database?: string;
  };
  pdm?: {
    enabled: boolean;        // Proxmox Datacenter Manager
    vm_ids?: number[];
    subdomain?: string;
  };
  gitea?: {
    enabled: boolean;
    vm_ids?: number[];
    subdomain?: string;
    database?: string;
  };
  harbor?: {
    enabled: boolean;        // Container registry
    vm_ids?: number[];
    subdomain?: string;
    database?: string;
    storage_backend?: string;  // MinIO reference
  };
}

// ───────────────────────────────────────────────────────────────────────────
// OBSERVABILITY - Monitoring, Logging, Alerting
// ───────────────────────────────────────────────────────────────────────────

export interface ObservabilityConfig {
  monitoring?: {
    enabled: boolean;
    type: "prometheus" | "victoria-metrics";
    vm_ids?: number[];
    retention_days?: number;
  };
  dashboards?: {
    enabled: boolean;
    type: "grafana";
    vm_ids?: number[];
    subdomain?: string;
    accessible_outside_vpn?: boolean;
  };
  logging?: {
    enabled: boolean;
    type: "loki";
    vm_ids?: number[];
    retention_days?: number;
  };
  alerting?: {
    enabled: boolean;
    type: "alertmanager";
    vm_ids?: number[];
  };
  status_page?: {
    enabled: boolean;
    type: "uptime-kuma";
    vm_ids?: number[];
    subdomain?: string;
    accessible_outside_vpn?: boolean;  // Usually true for status page
  };
  siem?: {
    enabled: boolean;
    type: "wazuh";
    vm_ids?: number[];
    retention_days?: number;
  };
  // Compliance configuration - determines automatic security/HA choices
  compliance?: {
    level: ComplianceLevel;
    regulations?: RegulationType[];
  };
}

// ───────────────────────────────────────────────────────────────────────────
// K8S CLUSTER - Kubernetes configuration
// ───────────────────────────────────────────────────────────────────────────

export interface K8sCluster {
  name: string;
  public_ip?: FloatingIP;

  ingress?: {
    type: "traefik" | "nginx";
    replicas: number;
    dashboard?: boolean;
    dashboard_subdomain?: string;
  };

  metallb?: {
    enabled: boolean;
    mode: "layer2";
    address_pool: string;
  };

  ha_proxy_nodes?: {
    name: string;
    vm_id: number;
  }[];

  master_nodes: {
    name: string;
    vm_id: number;
  }[];

  worker_nodes: {
    name: string;
    vm_id: number;
  }[];

  network?: {
    pod_cidr?: string;
    service_cidr?: string;
    cni?: "cilium" | "calico";
    cilium_features?: {
      ebpf_enabled?: boolean;
      cluster_mesh?: boolean;
    };
  };

  auto_scaling?: K8sAutoScalingConfig;
}

export interface K8sAutoScalingConfig {
  enabled: boolean;
  min_nodes: number;
  max_nodes: number;
  cpu_utilization_percentage: number;
  providers: {
    type: "public_cloud" | "onprem";
    platform: "aws" | "gcp" | "azure" | "onprem";
    priority: number;
    max_nodes: number;
    region?: string;
    ressources: {
      instance_type?: string;
      cpu?: number;
      ram?: number;
      disk_size?: number;
    };
    credentials?: {
      access_key?: CredentialRef;
      secret_key?: CredentialRef;
    };
  }[];
}

// ───────────────────────────────────────────────────────────────────────────
// APPS - Application deployments
// ───────────────────────────────────────────────────────────────────────────

export interface AppsConfig {
  [appName: string]: AppDefinition;
}

export interface AppDefinition {
  enabled: boolean;
  deployment: "vm" | "cluster";
  vm_ids?: number[];
  replicas?: number;
  subdomain?: string;
  accessible_outside_vpn?: boolean;
  database?: string;
}

// ───────────────────────────────────────────────────────────────────────────
// SSH CONFIGURATION
// ───────────────────────────────────────────────────────────────────────────

export interface SSHConfig {
  users: SSHUser[];
}

export interface SSHUser {
  name: string;
  public_key: CredentialRef;
  private_key: CredentialRef;
  groups: UserGroupType[];
}

// ───────────────────────────────────────────────────────────────────────────
// VALIDATION TYPES
// ───────────────────────────────────────────────────────────────────────────

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  tier?: InfrastructureTierType;
}

export interface ValidationError {
  layer: LayerType | "platform" | "ssh";
  field: string;
  message: string;
  severity?: "error" | "critical";
  suggestion?: string;
  code?: string;
}

export interface ValidationWarning {
  layer: LayerType | "platform" | "ssh";
  field: string;
  message: string;
  suggestion?: string;
}

// ───────────────────────────────────────────────────────────────────────────
// PLAN TYPES
// ───────────────────────────────────────────────────────────────────────────

export interface PlanResult {
  actions: PlanAction[];
  summary: {
    to_create: number;
    to_update: number;
    to_delete: number;
  };
  warnings: string[];
  requires_confirmation: boolean;
}

export interface PlanAction {
  action: "create" | "update" | "delete";
  layer: LayerType;
  resource_type: string;
  resource_name: string;
  details?: string;
  depends_on?: string[];
}

// ───────────────────────────────────────────────────────────────────────────
// LEGACY TYPES (for backward compatibility)
// ───────────────────────────────────────────────────────────────────────────

/** @deprecated Use FirewallConfig instead */
export interface Firewall {
  public_ip: string;
  enabled: boolean;
  domain: string;
  type: "OPNsense" | "pfSense" | "vyos";
  vm_configuration: {
    vm_ids: number[];
    os_template: string;
  };
}

/** @deprecated Use VPNConfig instead */
export interface Bastion {
  enabled: boolean;
  type: "wireguard" | "headscale" | "netbird";
  public_ip: string;
  vm_configuration: {
    vm_ids: number[];
    os_template: string;
  };
  vpn_subnet?: string;
  oidc_enforced: true;
  database_type: "sqlite" | "postgres";
}

/** @deprecated Use SSOConfig instead */
export interface IdentityProvider {
  public_ip: string;
  enabled: boolean;
  domain: string;
  type: "keycloak" | "authentik";
  vm_configuration: {
    vm_ids: number[];
    os_template: string;
  };
}

/** @deprecated Use AppsConfig instead */
export interface Feature {
  cluster_name: string;
  traefik_dashboard?: FeatureItem;
  sso?: FeatureItem & { type: "keycloak" | "authentik" };
  vault?: FeatureItem;
  mail?: FeatureItem & { domains: string };
  monitoring?: FeatureItem;
  velero?: FeatureItem;
  postgres_operator?: FeatureItem;
  argocd?: FeatureItem;
  gitlab?: FeatureItem;
  pg_admin?: FeatureItem;
  nextcloud?: FeatureItem;
  wiki?: FeatureItem;
  sonarqube?: FeatureItem;
  nexus?: FeatureItem;
}

interface FeatureItem {
  enabled: boolean;
  sub_domains: string;
  accessible_outside_vpn: boolean;
}

/** @deprecated Use DatabaseCluster instead */
export type DatabaseConfig = DatabaseCluster;

export type NetworkType = {
  vlan: number;
  subnet: string;
  purpose: string;
  isolated: boolean;
  failover_subnet?: string;
  mtu: number;
};
