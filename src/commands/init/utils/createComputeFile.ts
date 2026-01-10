import { InitOptions } from "../utils";
import fs from "fs";
import path from "path";

export const createComputeFile = ({ projectName }: InitOptions, env?: string): void => {
  const fileName = env ? `compute-${env}.yaml` : "compute.yaml";
  const projectPath = path.resolve(process.cwd(), projectName);

  const filePath = path.join(projectPath, "layers/computes", fileName);

  const content = `# ############################################################
# 💻 COMPUTE RESOURCE CONFIGURATION ${env ? `- ${env.toUpperCase()}` : ""}
# ############################################################
# Documentation: https://docs.soverstack.io/configuration/computes
#
# RESERVED ID RANGES:
# - 100-199: Networking & Firewalls (VyOS/OPNsense)
# - 200-299: Bastion & Management (Headscale)
# - 300-399: Load Balancers (HAProxy)
# - 400-499: CI/CD Runners & Misc
# - 500-599: k8s Control Plane (Masters)
# - 600+: k8s Data Plane (Workers)
# ############################################################

# Predefined compute flavors for consistency
instance_type_definitions:
  - name: "k8s-master-std"
    cpu: 4
    ram: 8192
    disk: 50
    disk_type: "distributed" # Ceph/Replicated
    os_template: "ubuntu-24.04-cloudinit"

  - name: "k8s-worker-large"
    cpu: 8
    ram: 16384
    disk: 200
    disk_type: "distributed"
    os_template: "ubuntu-24.04-cloudinit"

# Individual VM Instances
virtual_machines:
  # --- CONTROL PLANE ---
  - name: "master-01"
    vm_id: 500
    host: "proxmox-node-01"
    type_definition: "k8s-master-std"
    role: "k8s_master"
    # Note: Access via Headscale VPN only (No Public IP)

  # --- DATA PLANE ---
  - name: "worker-01"
    vm_id: 600
    host: "proxmox-node-02"
    type_definition: "k8s-worker-large"
    role: "k8s_worker"

  - name: "worker-02"
    vm_id: 601
    host: "proxmox-node-03"
    type_definition: "k8s-worker-large"
    role: "k8s_worker"

  # --- CI/CD RUNNERS ---
  - name: "runner-01"
    vm_id: 400
    host: "proxmox-node-01"
    cpu: 4
    ram: 4096
    disk: 40
    disk_type: "local" # High speed local NVMe for builds
    os_template: "ubuntu-24.04-cloudinit"
    role: "ci_runner"

linux_containers: []
`;
  fs.writeFileSync(filePath, content);
};
