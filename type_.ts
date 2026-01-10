export interface Datacenter {
  name: string;
  servers: {
    name: string;
    id: number;
    ip: string;
    port: number;
    root_password?: string; // RISKY use root_password_env_var instead or pass_key_vault_path
    pass_key_vault_path?: string;
    root_password_env_var?: string;

    is_gpu_server?: boolean;
    os: "ubuntu" | "debian" | "rescue" | "proxmox";
    description?: ServerDescriptionType;
    disk_encryption: {
      enabled: boolean;
      pass_key?: string;
      pass_key_env_var?: string;
    };
  }[];
  network: {
    type: "vswitch" | "vrack" | "local" | "wireguard"; // autre truc
    failover_subnet?: string;
  };
  ceph: {
    private_network?: string;
    public_network?: string;
    enabled?: boolean;
    ceph_name?: boolean;
    servers: string[]; // list of server names
  };
  /*  reflechir a en rajouter le vitesse du network peut etre perfomant par network
    un pour ceph public 
    un pour ceph private
    un pour corosync public
    un pour corosync private
    un pour exposer vm public
    */
  cluster: {
    // proxmox cluster config
    servers: string[]; // list of server names
    network_range?: string;
    private_network?: string;
    public_network?: string;
  };
  alert: {
    admin_email: string;
  };
}

export interface Compute {
  virtual_machines: VM[];
  linux_containers: VM[];
}

interface Firewall extends VM {
  publicIp: string;
  enabled: boolean;
  type: "OPNsense"; // could add more types later
  //   failoverIP: string;
  useAsBastion: boolean;
  highAvailability?: boolean;
}

interface Bastion extends VM {
  publicIp: string;
  enabled: boolean;
  //   failoverIP: string;
}

interface Platform {
  name: string;
  version: string; // soverstack version
  environment: string;
  domain: string;

  layers: {
    bastions?: string;
    fiewall?: string;
    datacenter: string;
    compute?: string;
    clusters?: string;
    features?: string;
    ssh?: string;
  };
  secrets: {
    provider: "vault" | "sops" | "env" | "aws-secrets-manager";
    vault_address?: string;
    sops_key?: string;
  };
}

interface SSHKeys {
  user: string;
  public_key_path?: string;
  private_key_path?: string;
  public_key_env_var?: string;
  private_key_env_var?: string;
  groups: "sudo" | "ci" | "both";
}

interface PlatformManager {
  name: string;
  version: string; // soverstack version
  domain: string;
  environment: string;
  datacenters: Datacenter[];
}

export interface Feature {
  clusterName?: string;
  traefikDashboard?: { enabled: boolean; subDomains: string };
  sso?: {
    enabled: boolean;
    type: "keycloak" | "authentik";
    subDomains: string;
  };
  vault?: {
    enabled: boolean;
    subDomains: string;
    accessibleOutsideVPN: boolean;
  };
  mail?: {
    enabled: boolean;
    domains: string;
    subDomains: string;
    accessibleOutsideVPN: boolean;
  };
  monitoring?: {
    enabled: boolean;
    subDomains: string;
    accessibleOutsideVPN: boolean;
  };
  velero?: {
    enabled: boolean;
    subDomains: string;
    accessibleOutsideVPN: boolean;
  };
  postgresOperator?: {
    enabled: boolean;
    subDomains: string;
    accessibleOutsideVPN: boolean;
  };
  argoCd?: {
    enabled: boolean;
    subDomains: string;
    accessibleOutsideVPN: boolean;
  };
  gitlab?: {
    enabled: boolean;
    subDomains: string;
    accessibleOutsideVPN: boolean;
  };
  pgAdmin?: {
    enabled: boolean;
    subDomains: string;
    accessibleOutsideVPN: boolean;
  };
  nextcloud?: {
    enabled: boolean;
    subDomains: string;
    accessibleOutsideVPN: boolean;
  };
  wiki?: {
    enabled: boolean;
    subDomains: string;
    accessibleOutsideVPN: boolean;
  };
  sonarqube?: {
    enabled: boolean;
    subDomains: string;
    accessibleOutsideVPN: boolean;
  };
  nexus?: {
    enabled: boolean;
    subDomains: string;
    accessibleOutsideVPN: boolean;
  };
}

export interface State {
  timestamp: string;
  platform: Platform;
  features: Feature;
}

export interface VM {
  name: string;
  ip: string;
  vmid: number;
  status: string;
  host: string; // doit etre un des server plus en haut
  disk: "ceph_name" | "local";
}

export interface Plan {
  to_add: string[];
  to_remove: string[];
  to_update: string[];
  warnings: string[];
}

export interface Server {
  name: string;
  id: number;
  ip: string;
  port: number;
  rootPassword: string;
  ciUser: string;
  os: "ubuntu" | "debian" | "rescue" | "proxmox";
  description?: ServerDescriptionType;
}

export interface ServerDescriptionType {
  ram: number;
  cores: number;
  disks?: ServerDescriptionDiskType[];
}

export interface ServerDescriptionDiskType {
  type: "ssd" | "hdd" | "nvme";
  size: number;
}

export interface OpnSenseVMType extends VM {
  publicIp: string;
}

interface K8sCluster {
  name: string;
  haProxyNodes: string[]; // --> 2 VMs IDs
  nodes: {
    masters: string[];
    workers: string[];
  };
  auto_scaling?: {
    enabled: boolean;
    min_nodes: number;
    max_nodes: number;
    cpu_utilization_percentage: number;
    auto_scaling_provider: "aws" | "gcp" | "azure" | "onprem";
  };
}

// Apres la premiere installation on ne peut plus faire de "init" dans un dossier deja initialiser et aussi du apply
// tout se fais a partir de update, add, remove
// et finalement destroy si on veut tout supprimer
// Structure du dossier d'un projet soverstack

// my-project/
// ├── manager.yaml          // PlatformManager config
// ├── platform.yaml          // Main config
// ├── README.md // une petit recap des commandes possibles a utiliser
// ├── ssh/                     // SSH keys (auto-generated)
// │   ├── prod // or ssh-prod.yaml contient une liste du type: SSHKeys[] EN YAML biensur et tres important, soit le user,
// //  la private_key_path et la public_key_path soit la private_key_env_var et la public_key_env_var
// ├── datacenters/
// │   └── dc.yaml  // datacenter config type: Datacenter
// ├── computes/
// │   └── compute.yaml // compute config type: Compute
// ├── firewalls/
// │   └── firewall.yaml // firewall config type: Firewall
// ├── bastions/
// │   └── bastion.yaml // bastion config type: Bastion
// ├── clusters/
// │   └── k8s.yaml  // cluster config type: K8sCluster
// ├── features/
// │   └── feature.yaml // features config type: Feature ou ti tu veux faire es changements specifiques sur des features, tu creer un fichier par example gitlab.yaml, nextcloud.yaml, etc.

// s il ya des environnements, on peut faire des sous dossiers et conseille de faire un dossier par environnement
// ex: dc-prod.yaml, dc-staging.yaml, etc.

/* Les commandes possibles:
- soverstack init
- soverstack validate
- soverstack validate datacenter <datacenter-name>
- soverstack validate compute <compute-name>
- soverstack validate cluster <k8s-name>
- soverstack validate feature <feature-name>
- soverstack plan
- soverstack plan datacenter <datacenter-name>
- soverstack plan compute <compute-name>
- soverstack plan cluster <k8s-name>
- soverstack plan feature <feature-name>

- soverstack apply // il va generer juste les inventories et tfvars pour que ansible et terraform puissent faire leur travail
- soverstack apply datacenter <datacenter-name>
- soverstack apply compute <compute-name>
- soverstack apply cluster <k8s-name>
- soverstack apply feature <feature-name>

- soverstack destroy // destroy tout le platform 
- soverstack destroy datacenter <datacenter-name> // destroy un datacenter specifique pas possible de destroy dc si il y a des computes ou clusters qui en dependent, ainsi de suite
- soverstack destroy compute <compute-name>
- soverstack destroy cluster <k8s-name>
- soverstack destroy feature <feature-name>
- soverstack dns:update
- soverstack graph
- soverstack graph:all
- soverstack graph:cluster <k8s-name>
- soverstack graph:datacenter <datacenter-name>
- soverstack graph:compute <compute-name>
- soverstack graph:feature <feature-name>
- soverstack generate:ssh-keys
*/
