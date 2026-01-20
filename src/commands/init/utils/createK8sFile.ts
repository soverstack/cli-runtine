import { InitOptions } from "./index";
import fs from "fs";
import path from "path";

export const createK8sFile = ({
  projectName,
  infrastructureTier,
  outputDir,
}: InitOptions): void => {
  const targetDir = outputDir || path.resolve(process.cwd(), projectName);
  const filePath = path.join(targetDir, "k8s.yaml");

  const isLocal = infrastructureTier === "local";
  const minMasters = isLocal ? 1 : 3;
  const minWorkers = isLocal ? 1 : 2;
  const minLB = isLocal ? 1 : 2;
  const ingressReplicas = isLocal ? 1 : 2;

  const content = `# ============================================================
# KUBERNETES CLUSTER CONFIGURATION
# ============================================================
#
# Documentation: https://docs.soverstack.io/layers/k8s
#
# REQUIREMENTS FOR ${isLocal ? "LOCAL" : "PRODUCTION/ENTERPRISE"}:
# - Minimum ${minMasters} master node(s) ${isLocal ? "" : "(for etcd quorum)"}
# - Minimum ${minWorkers} worker node(s)
# - Minimum ${minLB} HAProxy node(s) for API HA
#
# VM ID RANGES:
# - 400-449: Load Balancers (HAProxy)
# - 500-599: K8s Control Plane (Masters)
# - 600-3000: K8s Data Plane (Workers)
#
# ============================================================

name: "${projectName}-k8s"

# ------------------------------------------------------------
# PUBLIC IP (for ingress)
# ------------------------------------------------------------
# Assigned from the public_ip block in networking.yaml
#
public_ip:
  ip: ""                  # e.g., "203.0.113.10"
  vrrp_id: 10             # Unique VRRP ID (1-255)
  health_check:
    type: tcp
    port: 443

# ------------------------------------------------------------
# INGRESS CONTROLLER
# ------------------------------------------------------------
# Manages incoming HTTP/HTTPS traffic to the cluster
#
ingress:
  type: traefik           # traefik | nginx
  replicas: ${ingressReplicas}              # ${isLocal ? "1 for local" : "2 for HA"}
  dashboard: true
  dashboard_subdomain: traefik

# ------------------------------------------------------------
# METALLB (LoadBalancer for bare-metal)
# ------------------------------------------------------------
# Provides LoadBalancer service type for K8s on bare-metal
#
metallb:
  enabled: true
  mode: layer2            # layer2 | bgp (bgp coming soon)
  address_pool: ""        # e.g., "203.0.113.100-203.0.113.200"

# ------------------------------------------------------------
# HAPROXY (K8s API Load Balancer)
# ------------------------------------------------------------
# Required for HA: load balances traffic to K8s API (6443)
#
ha_proxy_nodes:
${isLocal ? `  - name: "k8s-lb-01"
    vm_id: 400` : `  - name: "k8s-lb-01"
    vm_id: 400            # Range: 400-449
  - name: "k8s-lb-02"
    vm_id: 401`}

# ------------------------------------------------------------
# CONTROL PLANE (Masters)
# ------------------------------------------------------------
# ${isLocal ? "Single master for local" : "Spread across different Proxmox hosts for HA"}
#
master_nodes:
${isLocal ? `  - name: "master-01"
    vm_id: 500` : `  - name: "master-01"
    vm_id: 500            # Range: 500-599
  - name: "master-02"
    vm_id: 501
  - name: "master-03"
    vm_id: 502`}

# ------------------------------------------------------------
# DATA PLANE (Workers)
# ------------------------------------------------------------
worker_nodes:
${isLocal ? `  - name: "worker-01"
    vm_id: 600` : `  - name: "worker-01"
    vm_id: 600            # Range: 600-3000
  - name: "worker-02"
    vm_id: 601`}

# ------------------------------------------------------------
# NETWORK CONFIGURATION
# ------------------------------------------------------------
network:
  pod_cidr: "10.244.0.0/16"
  service_cidr: "10.96.0.0/12"
  cni: cilium             # cilium | calico
  cilium_features:
    ebpf_enabled: true
    cluster_mesh: false   # Enable for multi-cluster

# ------------------------------------------------------------
# AUTO-SCALING (Optional)
# ------------------------------------------------------------
# Hybrid auto-scaling: on-prem first, then burst to cloud
#
auto_scaling:
  enabled: false
  min_nodes: ${minWorkers}
  max_nodes: 50
  cpu_utilization_percentage: 70

  providers:
    - type: onprem
      platform: onprem
      priority: 1
      max_nodes: 10
      ressources:
        instance_type: "k8s-worker-large"  # Reference to compute.yaml

    # Burst to cloud when on-prem is full
    # - type: public_cloud
    #   platform: aws
    #   priority: 2
    #   region: "eu-central-1"
    #   max_nodes: 10
    #   ressources:
    #     instance_type: "t3.medium"
    #   credentials:
    #     access_key:
    #       type: env
    #       var_name: AWS_ACCESS_KEY_ID
    #     secret_key:
    #       type: env
    #       var_name: AWS_SECRET_ACCESS_KEY
`;

  fs.writeFileSync(filePath, content);
};
