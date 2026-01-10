import { InitOptions } from "../utils";
import fs from "fs";
import path from "path";

export const createClusterFile = ({ projectName }: InitOptions, env?: string) => {
  const fileName = env ? `k8s-${env}.yaml` : "k8s.yaml";
  const projectPath = path.resolve(process.cwd(), projectName);
  const filePath = path.join(projectPath, "layers/clusters", fileName);

  const content = `# ############################################################
# ☸️ KUBERNETES CLUSTER CONFIGURATION ${env ? `- ${env.toUpperCase()}` : ""}
# ############################################################
# Documentation: https://docs.soverstack.io/configuration/clusters
#
# ARCHITECTURE NOTE:
# For a High Availability (HA) and performance Control Plane is MANDATORY.
# Minimum: 3 Masters nodes to maintain Etcd quorum.
# ############################################################
#
# RESERVED VM ID RANGES:
# - 100-199: Firewalls (VyOS/OPNsense/pfSense)
# - 200-299: Bastions (Headscale/Wireguard/Netbird)
# - 300-399: Load Balancers (HAProxy)
# - 400-499: CI/CD Runners & Misc
# - 500-599: K8s Control Plane (Masters)
# - 600+: K8s Data Plane (Workers)
# ############################################################

name: "${projectName}-k8s${env ? `-${env}` : ""}"

# --- Load Balancing ---
# Use these for the Kubernetes API (port 6443) HA
ha_proxy_nodes:
  - name: "k8s-lb-01"
    vm_id: 301  # Range: 300-399 (Load Balancers)
  - name: "k8s-lb-02"
    vm_id: 302

# --- Control Plane (Masters) ---
# Spread these across different physical Proxmox hosts
master_nodes:
  - name: "master-01"
    vm_id: 500  # Range: 500-599 (K8s Masters)
  - name: "master-02"
    vm_id: 501
  - name: "master-03"
    vm_id: 502

# --- Data Plane (Workers) ---
worker_nodes:
  - name: "worker-01"
    vm_id: 600  # Range: 600+ (K8s Workers)
  - name: "worker-02"
    vm_id: 601
 

# ############################################################
# 📈 HYBRID AUTO-SCALING (PROXMOX + PUBLIC CLOUD)
# ############################################################
# Read: https://docs.soverstack.io/deep-dive/auto-scaling
# ############################################################

auto_scaling:
  enabled: false
  min_nodes: 3
  max_nodes: 50
  cpu_utilization_percentage: 70

  # Scaling Strategy: On-prem first, then burst to Public Cloud
  providers:
    - type: "onprem"
      platform: "onprem"
      priority: 1
      max_nodes: 10
      ressources:
        instance_type: "standard"  # Reference to compute instance_type_definitions

    - type: "public_cloud"
      platform: "aws"  # aws | gcp | azure
      priority: 2      # Burst to AWS only when Proxmox is full
      region: "eu-central-1"
      max_nodes: 10
      ressources:
        instance_type: "t3.medium"  # AWS instance type
      credentials:
        vault_path: "secret/data/infra/aws/credentials"
`;
  fs.writeFileSync(filePath, content);
};
