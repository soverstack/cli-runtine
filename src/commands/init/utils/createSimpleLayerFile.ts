import { InitOptions } from "../utils";
import fs from "fs";
import path from "path";

/**
 * Creates a simplified all-in-one infrastructure configuration file.
 *
 * SIMPLE MODE STRUCTURE:
 * Instead of separating concerns into datacenter/compute/cluster/features,
 * this mode combines everything into a single, easy-to-understand file.
 *
 * Ideal for:
 * - Small projects
 * - Quick prototyping
 * - Learning Soverstack
 * - Single-environment deployments
 */
export const createSimpleLayerFile = ({ projectName }: InitOptions, env?: string): void => {
  const fileName = env ? `infrastructure-${env}.yaml` : "infrastructure.yaml";
  const projectPath = path.resolve(process.cwd(), projectName);
  const filePath = path.join(projectPath, "layers", fileName);

  const content = `# ############################################################
# 📦 SIMPLE MODE - ALL-IN-ONE PLATFORM${env ? ` - ${env.toUpperCase()}` : ""}
# ############################################################
# Documentation: https://docs.soverstack.io/docs/file-structure#simple-mode
#
# This file combines datacenter, compute, cluster, and feature
# configurations into a single, easy-to-manage file.
#
# For advanced multi-datacenter setups, use "advanced" mode.
# ############################################################


# ============================================================
# DATACENTER CONFIGURATION
# ============================================================
datacenter:
  name: "${projectName}-dc${env ? `-${env}` : ""}"

  # Servers (Physical Proxmox Nodes)
  # Minimum 3 servers recommended for HA
  servers:
    - name: "proxmox-node-01"
      id: 1
      ip: "192.168.1.10"
      port: 22
      os: "proxmox"
      # Security: Use environment variables for passwords
      root_password_env_var: "PROXMOX_ROOT_PASSWORD"

  # Network Configuration
  network:
    type: "vswitch"  # vswitch | vrack | local | wireguard
    failover_subnet: "203.0.113.0/29"  # Your public IP subnet

  # Ceph Distributed Storage (optional)
  ceph:
    enabled: false
    servers: []  # List server names if enabled
    private_network: "10.0.1.0/24"
    public_network: "10.0.2.0/24"

  # Proxmox Cluster
  cluster:
    private_network: "10.0.10.0/24"
    public_network: "10.0.11.0/24"

  # Alerting
  alert:
    admin_email: "admin@example.com"

# ============================================================
# FIREWALL CONFIGURATION
# ============================================================
firewall:
  enabled: true
  type: "vyos"  # vyos | OPNsense | pfSense (only vyos supported now)
  public_ip: "203.0.113.1"  # From failover_subnet

  vm_configuration:
    vm_ids: [100, 101]  # Reserved range: 100-199
    os_template: "debian-12-cloudinit"

# ============================================================
# BASTION / VPN CONFIGURATION
# ============================================================
bastion:
  enabled: true
  type: "headscale"  # headscale | wireguard | netbird
  public_ip: "203.0.113.2"  # From failover_subnet

  vm_configuration:
    vm_ids: [200, 201]  # Reserved range: 200-299
    os_template: "debian-12-cloudinit"

  vpn_subnet: "100.64.0.0/10"
  oidc_enforced: true
  database_type: "postgres"  # postgres | sqlite

# ============================================================
# COMPUTE RESOURCES (VMs)
# ============================================================
# RESERVED ID RANGES (CRITICAL):
# - 100-199: Firewalls (already used above)
# - 200-299: Bastions (already used above)
# - 300-399: Load Balancers
# - 400-499: CI/CD Runners & Misc
# - 500-599: K8s Control Plane (Masters)
# - 600+: K8s Data Plane (Workers)
# ============================================================
compute:
  # Predefined VM types for reusability
  instance_type_definitions:
    - name: "k8s-master"
      cpu: 4
      ram: 8192   # MB
      disk: 50    # GB
      disk_type: "distributed"  # distributed (Ceph) | local
      os_template: "ubuntu-24.04-cloudinit"

    - name: "k8s-worker"
      cpu: 8
      ram: 16384
      disk: 200
      disk_type: "distributed"
      os_template: "ubuntu-24.04-cloudinit"

  # Virtual Machines
  virtual_machines:
    # --- Load Balancers (HAProxy) ---
    - name: "k8s-lb-01"
      vm_id: 300  # Range: 300-399 (Load Balancers)
      host: "proxmox-node-01"
      cpu: 2
      ram: 2048
      disk: 20
      disk_type: "local"
      os_template: "debian-12-cloudinit"
      role: "general_purpose"

    # --- Kubernetes Masters ---
    - name: "master-01"
      vm_id: 500  # Range: 500-599 (K8s Masters)
      host: "proxmox-node-01"
      type_definition: "k8s-master"
      role: "k8s_master"

    - name: "master-02"
      vm_id: 501
      host: "proxmox-node-02"
      type_definition: "k8s-master"
      role: "k8s_master"

    - name: "master-03"
      vm_id: 502
      host: "proxmox-node-03"
      type_definition: "k8s-master"
      role: "k8s_master"

    # --- Kubernetes Workers ---
    - name: "worker-01"
      vm_id: 600  # Range: 600+ (K8s Workers)
      host: "proxmox-node-01"
      type_definition: "k8s-worker"
      role: "k8s_worker"

    - name: "worker-02"
      vm_id: 601
      host: "proxmox-node-02"
      type_definition: "k8s-worker"
      role: "k8s_worker"

  # Linux Containers (LXC) - Optional
  linux_containers: []

# ============================================================
# KUBERNETES CLUSTER
# ============================================================
cluster:
  name: "${projectName}-k8s${env ? `-${env}` : ""}"

  # Load Balancers (HAProxy for K8s API)
  ha_proxy_nodes:
    - name: "k8s-lb-01"
      vm_id: 300

  # Control Plane
  master_nodes:
    - name: "master-01"
      vm_id: 500
    - name: "master-02"
      vm_id: 501
    - name: "master-03"
      vm_id: 502

  # Data Plane
  worker_nodes:
    - name: "worker-01"
      vm_id: 600
    - name: "worker-02"
      vm_id: 601

  # Networking
  network:
    pod_cidr: "10.244.0.0/16"
    service_cidr: "10.96.0.0/12"
    cni: "cilium"  # cilium | calico | flannel
    cilium_features:
      ebpf_enabled: true
      cluster_mesh: true

  # Auto-Scaling (optional)
  auto_scaling:
    enabled: false
    min_nodes: 3
    max_nodes: 10
    cpu_utilization_percentage: 70
    providers: []

# ============================================================
# KUBERNETES FEATURES & APPLICATIONS
# ============================================================
features:
  cluster_name: "${projectName}-k8s${env ? `-${env}` : ""}"

  # Traefik Ingress Controller
  traefik_dashboard:
    enabled: true
    sub_domains: "traefik"
    accessible_outside_vpn: false

  # SSO / Identity Provider
  sso:
    enabled: false
    type: "authentik"  # authentik | keycloak
    sub_domains: "sso"
    accessible_outside_vpn: false



# ============================================================
# SSH KEYS
# ============================================================
# Place your SSH keys in the ./ssh/ directory
# Public key will be deployed to all VMs for automation
# ============================================================

# ============================================================
# NEXT STEPS:
# ============================================================
# 1. Update server IPs and credentials
# 2. Set environment variables for secrets:
#    export PROXMOX_ROOT_PASSWORD="your-password"
# 3. Configure your domain name
# 4. Enable/disable features as needed
# 5. Validate: soverstack validate platform.yaml
# 6. Plan: soverstack plan
# 7. Apply: soverstack apply
# ============================================================
`;

  fs.writeFileSync(filePath, content);
};
