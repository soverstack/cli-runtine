// ═══════════════════════════════════════════════════════════════════════════
// SOVERSTACK RUNTIME - TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════
//
// ⚠️ SÉCURITÉ CRITIQUE :
// - JAMAIS de mots de passe en clair dans les fichiers YAML
// - JAMAIS de clés SSH privées dans le repo Git
// - TOUJOURS utiliser des variables d'environnement ou Vault
// - TOUJOURS chiffrer les fichiers sensibles avec SOPS
//
// Convention: snake_case pour les propriétés, PascalCase pour les interfaces
//
// ═══════════════════════════════════════════════════════════════════════════

// ───────────────────────────────────────────────────────────────────────────
// DATACENTER - Configuration des serveurs physiques
// ───────────────────────────────────────────────────────────────────────────
export interface Datacenter {
  name: string;
  servers: {
    name: string; // unique server name
    id: number;
    ip: string;
    port: number;

    // ⚠️ SÉCURITÉ: Jamais de mot de passe en clair !
    root_password_env_var?: string; // Ex: "ROOT_PASSWORD_SRV1"
    root_password_vault_path?: string; // Ex: "secret/data/servers/srv1/root_password"
    root_password?: string; // ⚠️ RISKY - DEPRECATED

    is_gpu_server?: boolean;
    os: "ubuntu" | "debian" | "rescue" | "proxmox";
    description?: ServerDescriptionType;

    disk_encryption: {
      enabled: boolean;
      pass_key_env_var?: string; // Ex: "DISK_ENCRYPTION_KEY_SRV1"
      pass_key_vault_path?: string; // Ex: "secret/data/servers/srv1/disk_key"
      pass_key?: string; // ⚠️ RISKY - DEPRECATED // reffuser ca
    };
  }[];

  network: {
    type: "vswitch" | "vrack" | "local" | "wireguard"; // now juste vswitch
    failover_subnet?: string;
  };

  ceph: {
    private_network?: string;
    public_network?: string;
    enabled?: boolean;
    servers: string[]; // list of server names , minimum 3 servers for ceph
  };
  // Trouver une meilleure façon de gérer cela
  // storage: {
  //   main_storage: string; // storage name
  //   backup_storage: string; // storage name
  // };

  cluster: {
    // proxmox cluster config
    // servers: string[]; // list of server names
    // network_range?: string;
    private_network?: string;
    public_network?: string;
  };

  alert: {
    admin_email: string;
  };
}

export interface IdentityProvider {
  public_ip: string;
  enabled: boolean;
  domain: string;
  type: "keycloak" | "authentik"; //  pour l instant que keycloak
  vm_configuration: {
    vm_ids: number[]; // IDs des VMs Bastion, at least 2 for HA
    os_template: string; // e.g., "debian-12", "ubuntu-20.04", "ubuntu-24.04", debian if vyos
  };
}

export interface Firewall {
  public_ip: string;
  enabled: boolean;
  domain: string;
  type: "OPNsense" | "pfSense" | "vyos"; // combinaison headscale/vyos, pour l instant que vyos
  vm_configuration: {
    vm_ids: number[]; // IDs des VMs Bastion, at least 2 for HA
    os_template: string; // e.g., "debian-12", "ubuntu-20.04", "ubuntu-24.04", debian if vyos
  };
}

// ───────────────────────────────────────────────────────────────────────────
// BASTION - Configuration du serveur bastion
// ───────────────────────────────────────────────────────────────────────────
export interface Bastion {
  enabled: boolean;
  type: "wireguard" | "headscale" | "netbird"; // combinaison headscale/vyos, pour l instant que headscale
  public_ip: string;
  vm_configuration: {
    vm_ids: number[]; // IDs des VMs Bastion, at least 2 for HA
    os_template: string; // e.g., "debian-12", "ubuntu-20.04", "ubuntu-24.04"    or an url, debian if headscale
  };
  vpn_subnet?: string;
  oidc_enforced: true; // always enforce, can't be turn off
  database_type: "sqlite" | "postgres";
}

// ───────────────────────────────────────────────────────────────────────────
// PLATFORM - Configuration principale du projet
// ───────────────────────────────────────────────────────────────────────────
export interface Platform {
  project_name: string;
  version: string; // soverstack version
  environment?: string;
  domain: string;
  infrastructure_tier: InfrastructureTierType;

  // // Configuration du secrets management
  // secrets?: {
  //   provider: "vault" | "sops" | "env" | "aws-secrets-manager";
  //   vault_address?: string;
  //   vault_token_env_var?: string;
  //   sops_key_path?: string;
  // };

  layers: {
    bastions?: string;
    firewall?: string;
    iam?: string;
    datacenter: string;
    compute?: string;
    clusters?: string;
    features?: string;
    observability?: string;
  };

  ssh: string;

  state: {
    backend: BackendType;
    path: string;
  };
}

export type InfrastructureTierType = "local" | "production" | "enterprise";
export type BackendType = "local" | "aws" | "gcr" | "azure";
// ───────────────────────────────────────────────────────────────────────────
// SSH KEYS - Configuration des clés SSH
// ───────────────────────────────────────────────────────────────────────────
export interface SSHKeys {
  user: string;

  // ⚠️ SÉCURITÉ: Privilégier les variables d'environnement
  public_key_env_var?: string;
  private_key_env_var?: string;

  // Chemin absolu HORS du repo
  public_key_path?: string;
  private_key_path?: string;

  // Vault
  public_key_vault_path?: string;
  private_key_vault_path?: string;

  groups: UserGroupType;
}

export type UserGroupType = "sudo" | "docker" | "kvm" | "systemd-journal" | "adm";
type PossibleOSTemplates =
  | "debian-12-cloudinit"
  | "ubuntu-20.04-cloudinit"
  | "ubuntu-24.04-cloudinit";
// ───────────────────────────────────────────────────────────────────────────
// PLATFORM MANAGER - Gestion multi-datacenter
// ───────────────────────────────────────────────────────────────────────────
export interface PlatformManager {
  name: string;
  version: string;
  domain: string;
  environment: string;
  datacenters: Datacenter[];
}

// ───────────────────────────────────────────────────────────────────────────
// FEATURES - Applications et services Kubernetes
// ───────────────────────────────────────────────────────────────────────────
export interface Feature {
  cluster_name: string;
  // # Logging Stack
  // logging:
  //   enabled: false
  //   # loki: true
  //   # promtail: true

  // # Cert Manager
  // cert_manager:
  //   enabled: true
  //   email: "admin@example.com"
  //   production: ${env === "prod" ? "true" : "false"}

  // # Backup
  // backup:
  //   enabled: true // il faut un fichier de conf pour ca
  //   schedule: "0 2 * * *" # Daily at 2 AM
  //   retention_days: 30

  traefik_dashboard?: {
    enabled: boolean;
    sub_domains: string;
    accessible_outside_vpn: boolean;
  };

  sso?: {
    enabled: boolean;
    type: "keycloak" | "authentik";
    sub_domains: string;
    accessible_outside_vpn: boolean;
  };

  vault?: {
    enabled: boolean;
    sub_domains: string;
    accessible_outside_vpn: boolean;
  };

  mail?: {
    enabled: boolean;
    domains: string;
    sub_domains: string;
    accessible_outside_vpn: boolean;
  };

  monitoring?: {
    enabled: boolean;
    sub_domains: string;
    accessible_outside_vpn: boolean;
  };

  velero?: {
    enabled: boolean;
    sub_domains: string;
    accessible_outside_vpn: boolean;
  };

  postgres_operator?: {
    enabled: boolean;
    sub_domains: string;
    accessible_outside_vpn: boolean;
  };

  argocd?: {
    enabled: boolean;
    sub_domains: string;
    accessible_outside_vpn: boolean;
  };

  gitlab?: {
    enabled: boolean;
    sub_domains: string;
    accessible_outside_vpn: boolean;
  };

  pg_admin?: {
    enabled: boolean;
    sub_domains: string;
    accessible_outside_vpn: boolean;
  };

  nextcloud?: {
    enabled: boolean;
    sub_domains: string;
    accessible_outside_vpn: boolean;
  };

  wiki?: {
    enabled: boolean;
    sub_domains: string;
    accessible_outside_vpn: boolean;
  };

  sonarqube?: {
    enabled: boolean;
    sub_domains: string;
    accessible_outside_vpn: boolean;
  };

  nexus?: {
    enabled: boolean;
    sub_domains: string;
    accessible_outside_vpn: boolean;
  };
}

// ───────────────────────────────────────────────────────────────────────────
// STATE - État actuel de l'infrastructure
// ───────────────────────────────────────────────────────────────────────────
export interface State {
  timestamp: string;
  platform: Platform;
  features: Feature;
  last_applied_by?: string;
  last_applied_at?: string;
  version: string;
}

export type VMRole =
  | "firewall" // VyOS
  | "bastion" // Headscale
  | "iam_sso" // Authentik
  | "vault" // Hashicorp Vault
  | "database" // Postgres/Redis
  | "monitoring" // Prometheus/Grafana
  | "siem_audit" // Wazuh/Falco
  | "logging" // Loki
  | "load_balancer" // HAProxy
  | "k8s_master"
  | "k8s_worker"
  | "ci_runner"
  | "backup_server" // PBS
  | "storage_node" // MinIO
  | "general_purpose"
  | "template";

export interface ComputeType {
  name: string; // e.g., "high-mem-v1"
  cpu: number;
  ram: number; // in MB
  disk: number; // in GB
  os_template: PossibleOSTemplates | string; // must be compatible with cloud-init and an url , that will be handled in the provisioning process
  disk_type: "distributed" | "local";
  is_gpu_enabled?: boolean;
}

// # RESERVED ID RANGES: // doit etre valider aussi
// # - 100-199: Networking & Firewalls (VyOS/OPNsense)
// # - 200-299: Bastion & Management (Headscale)
// # - 300-399: Load Balancers (HAProxy)
// # - 400-499: CI/CD Runners & Misc
// # - 500-599: k8s Control Plane (Masters)
// # - 600- 2000: k8s Data Plane (Workers)
// # - 2000+: Other VMs

// | Range IDs | Catégorie                      | Exemples VMs                                           | Raison                                        |
// | --------- | ------------------------------ | ------------------------------------------------------ | --------------------------------------------- |
// | 1-99      | Networking & Firewalls         | VyOS HA (10,11), templates                             | Priorité absolue, HA VRRP .                   |
// | 100-199   | Bastion & Management           | Headscale (100), Ansible (110)                         | Bootstrap accès.                              |
// | 200-249   | IAM/SSO                        | Keycloak HA (200,201), Vault (210)                     | Auth centrale.                                |
// | 250-299   | Databases Centrales            | Postgres IAM (250), Redis cache (260)                  | External obligatoires prod/HA repl keycloak​. |
// | 300-349   | Monitoring/Observability       | Prometheus (300), Grafana (310), Loki (320)            | All-in-one ou split ; scrape tout.            |
// | 350-399   | Logging/Audit                  | Falco (350), ELK (360), Wazuh (370)                    | Complément observability.                     |
// | 400-449   | Load Balancers & Reverse Proxy | HAProxy (400), Nginx (410), subdomain firewall         | Post-security.                                |
// | 450-499   | CI/CD, Backup & Misc           | GitLab runners (450), PBS backup (460), Ceph mgr (470) | Outils ops.                                   |
// | 500-599   | k8s Control Plane              | Masters HA (500-503)                                   | Multi-master.                                 |
// | 600-3000  | k8s Data Plane                 | Workers (600+), stateful apps                          | Scalable.                                     |
// | 3000+     | Applications Autres            | Mailu (3000), Next.js apps, custom                     | Catch-all.                                    |

export interface VMBase {
  name: string;
  vm_id: number; // Check: Must not be in range 100-400 if not role firewall/bastion/load balancer
  host: string; // Target Proxmox node
  role: VMRole;
  public_ip?: string;
  status?: "running" | "stopped" | "provisioning";
}

// Allow either a predefined type OR manual specs
export interface VMBasedOnType extends VMBase {
  type_definition: string; // Reference to ComputeType.name
}

export interface VMCustom extends VMBase {
  cpu: number;
  ram: number;
  disk: number;
  disk_type: "distributed" | "local";
  os_template: string; // must be compatible with cloud-init for role worker,master and an url , that will be handled in the provisioning process
}

export interface ComputeConfig {
  instance_type_definitions: ComputeType[];
  virtual_machines: (VMBasedOnType | VMCustom)[]; // if role is bastion or firewall, vm_id must be in reserved range, and if bastion os_template must be compatible (debian)
  linux_containers: VMCustom[];
}

// ───────────────────────────────────────────────────────────────────────────
// PLAN - Résumé des changements à appliquer
// ───────────────────────────────────────────────────────────────────────────
export interface Plan {
  to_add: string[];
  to_remove: string[];
  to_update: string[];
  warnings: string[];

  summary?: {
    total_add: number;
    total_remove: number;
    total_update: number;
    estimated_duration?: string;
  };

  dry_run?: boolean;
}

export interface ServerDescriptionType {
  cpu: number;
  cores: number;
  disks?: ServerDescriptionDiskType[];
}

export interface ServerDescriptionDiskType {
  type: "ssd" | "hdd" | "nvme" | "sata" | "sas" | "scsi" | "ide";
  size: number; // in GB
}

// ───────────────────────────────────────────────────────────────────────────
// K8S CLUSTER - Configuration d'un cluster Kubernetes
// ───────────────────────────────────────────────────────────────────────────
export interface K8sCluster {
  name: string;

  //  verifier si c est deja use ailleur endroit,e doivent pas etre sur le meme host,
  //  et veifier le type, car en fonction du type de vm, il ya des contraintes de ressources
  // (ex: pas de k8s master sur un serveur avec 4go de ram) etc...
  ha_proxy_nodes: {
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

  auto_scaling?: {
    enabled: boolean; // ClusterMesh auto-scaling cilium
    min_nodes: number;
    max_nodes: number;
    cpu_utilization_percentage: number;
    providers: {
      type: "public_cloud" | "onprem";
      platform: "aws" | "gcp" | "azure" | "onprem";
      priority: number; // lower number = higher priority , not the same priority for multiple providers
      max_nodes: number;
      region?: string; // Ex: "us-east-1" for AWS, necessary for public_cloud

      ressources: {
        instance_type?: string; // Ex: "t3.medium" for AWS, si c est onprem, lire la doc pour les types disponibles de ressources dans
        // compute, si tu as passe un type ici, il doit exister dans compute et plus besoin de definir cpu,ram,disk_size
        cpu?: number;
        ram?: number; // in MB
        disk_size?: number; // in GB
      };
      credentials: {
        access_key_env_var?: string;
        secret_key_env_var?: string;
        file_path?: string;
        vault_path?: string;
      };
    }[];
  };
  network?: {
    pod_cidr?: string;
    service_cidr?: string;
    // default cni is calico and only cilium has advanced features,
    // allow are only calico and cilium on this version
    cni?: "cilium" | "calico" | "weave" | "flannel";
    cilium_features?: {
      // only if cni is cilium and
      ebpf_enabled?: boolean;
      cluster_mesh?: boolean; // Required for your Hybrid Cloud setup
    };
  };
}

// ───────────────────────────────────────────────────────────────────────────
// COMMANDES - Types pour les commandes CLI
// ───────────────────────────────────────────────────────────────────────────
export type SoverstackCommand =
  | "init"
  | "validate"
  | "plan"
  | "apply"
  | "destroy"
  | "dns:update"
  | "graph"
  | "graph:all"
  | "graph:cluster"
  | "graph:datacenter"
  | "graph:compute"
  | "graph:feature"
  | "graph:firewall"
  | "graph:bastion"
  | "generate:ssh-keys";

export type LayerType =
  | "datacenter"
  | "compute"
  | "cluster"
  | "feature"
  | "firewall"
  | "bastion"
  | "iam"
  | "observability";

export interface CommandOptions {
  dry_run?: boolean;
  verbose?: boolean;
  force?: boolean;
  environment?: string;
}

export interface ValidateOptions extends CommandOptions {
  layer?: LayerType;
  name?: string;
}

export interface PlanOptions extends CommandOptions {
  layer?: LayerType;
  name?: string;
}

export interface ApplyOptions extends CommandOptions {
  layer?: LayerType;
  name?: string;
  auto_approve?: boolean;
}

export interface DestroyOptions extends CommandOptions {
  layer?: LayerType;
  name?: string;
  auto_approve?: boolean;
}

interface SimpleInfrastructure {
  project: {
    name: string;
    environment?: string;
    domain: string;
  };
  datacenter: Datacenter;
  compute: ComputeConfig;
  cluster?: K8sCluster;
  firewall?: Firewall;
  bastion?: Bastion;
  features?: Feature;
  ssh: string; // path to ssh config file
  state: {
    backend: "local";
    path: string; // where to store the state file
  };
}

export type LayerFileContent = SimpleInfrastructure | Platform;
