import { InitOptions } from "./index";
import fs from "fs";
import path from "path";

export const createComputeFile = ({ projectName, outputDir }: InitOptions): void => {
  const targetDir = outputDir || path.resolve(process.cwd(), projectName);
  const filePath = path.join(targetDir, "compute.yaml");

  const content = `# ============================================================
# APPLICATION COMPUTE CONFIGURATION
# ============================================================
#
# Your application VMs go here.
# Infrastructure VMs are in core-compute.yaml (auto-generated).
#
# Documentation: https://docs.soverstack.io/layers/compute
#
# VM ID RANGES FOR APPLICATIONS:
# - 400-499: K8s Load Balancers (HAProxy)
# - 500-599: K8s Control Plane (Masters)
# - 600-3000: K8s Data Plane (Workers)
# - 3001+: Custom application VMs
#
# ============================================================

# ------------------------------------------------------------
# INSTANCE TYPE DEFINITIONS
# ------------------------------------------------------------
# Define reusable VM templates for your applications
#
instance_type_definitions:
  - name: "app-small"
    cpu: 2
    ram: 4096
    disk: 50
    disk_type: "distributed"
    os_template: "ubuntu-24.04-cloudinit"

  - name: "app-medium"
    cpu: 4
    ram: 8192
    disk: 100
    disk_type: "distributed"
    os_template: "ubuntu-24.04-cloudinit"

  - name: "app-large"
    cpu: 8
    ram: 16384
    disk: 200
    disk_type: "distributed"
    os_template: "ubuntu-24.04-cloudinit"

  - name: "k8s-master-std"
    cpu: 4
    ram: 8192
    disk: 50
    disk_type: "distributed"
    os_template: "ubuntu-24.04-cloudinit"

  - name: "k8s-worker-large"
    cpu: 8
    ram: 16384
    disk: 200
    disk_type: "distributed"
    os_template: "ubuntu-24.04-cloudinit"

# ------------------------------------------------------------
# K8s NODES
# ------------------------------------------------------------
# Kubernetes nodes (referenced in k8s.yaml)
#
virtual_machines:
  # --- K8s CONTROL PLANE ---
  - name: "master-01"
    vm_id: 500
    host: "pve-01"
    type_definition: "k8s-master-std"
    role: "k8s_master"

  # --- K8s DATA PLANE ---
  - name: "worker-01"
    vm_id: 600
    host: "pve-02"
    type_definition: "k8s-worker-large"
    role: "k8s_worker"

  - name: "worker-02"
    vm_id: 601
    host: "pve-03"
    type_definition: "k8s-worker-large"
    role: "k8s_worker"

  # --- YOUR APPLICATION VMs ---
  # Add your custom VMs here (vm_id >= 3001)
  #
  # - name: "myapp-01"
  #   vm_id: 3001
  #   host: "pve-01"
  #   type_definition: "app-medium"
  #   role: "general_purpose"

# ------------------------------------------------------------
# LINUX CONTAINERS (LXC)
# ------------------------------------------------------------
# Optional: lightweight containers on Proxmox
#
linux_containers: []
`;
  fs.writeFileSync(filePath, content);
};
