import { InitOptions } from "./index";
import fs from "fs";
import path from "path";

export const createCoreComputeFile = ({
  projectName,
  infrastructureTier,
  outputDir,
  datacenters,
  currentDc,
}: InitOptions): void => {
  const targetDir = outputDir || path.resolve(process.cwd(), projectName);
  const filePath = path.join(targetDir, "core-compute.yaml");

  const isLocal = infrastructureTier === "local";
  const isMultiDc = datacenters && datacenters.length >= 2;
  const isPrimaryDc = !currentDc || (datacenters && datacenters[0] === currentDc);

  const content = `# ============================================================
# CORE COMPUTE - INFRASTRUCTURE VMs (AUTO-GENERATED)
# ============================================================
#
# ⚠️  DO NOT MODIFY THIS FILE - It is managed by Soverstack
#
# This file contains the infrastructure VMs required by Soverstack.
# For your application VMs, use compute.yaml instead.
#
# Documentation: https://docs.soverstack.io/layers/compute
#
# VM ID RANGES (see src/constants.ts):
# - 1-49:     Firewall (VyOS/OPNsense)
# - 50-99:    DNS (dnsdist, PowerDNS)
# - 100-149:  VPN (Headscale)
# - 150-199:  Secrets (OpenBao)
# - 200-249:  IAM (Keycloak)
# - 250-279:  Database (PostgreSQL)
# - 300-399:  Observability (Prometheus, Grafana, Loki)
# - 400-449:  Load Balancer (HAProxy)
# - 450-469:  Tools (Soverstack, Datacenter Manager)
#
# ============================================================

# ------------------------------------------------------------
# INSTANCE TYPE DEFINITIONS (Infrastructure)
# ------------------------------------------------------------
instance_type_definitions:
  - name: "firewall-std"
    cpu: 2
    ram: 2048
    disk: 20
    disk_type: "local"
    os_template: "vyos-1.4"

  - name: "vpn-std"
    cpu: 2
    ram: 2048
    disk: 20
    disk_type: "distributed"
    os_template: "debian-12-cloudinit"

  - name: "dns-std"
    cpu: 2
    ram: 2048
    disk: 20
    disk_type: "distributed"
    os_template: "debian-12-cloudinit"

  - name: "database-std"
    cpu: 4
    ram: 8192
    disk: 100
    disk_type: "distributed"
    os_template: "debian-12-cloudinit"

  - name: "security-std"
    cpu: 4
    ram: 4096
    disk: 50
    disk_type: "distributed"
    os_template: "debian-12-cloudinit"

  - name: "monitoring-std"
    cpu: 4
    ram: 8192
    disk: 200
    disk_type: "distributed"
    os_template: "debian-12-cloudinit"

  - name: "management-std"
    cpu: 2
    ram: 2048
    disk: 40
    disk_type: "distributed"
    os_template: "debian-12-cloudinit"

# ------------------------------------------------------------
# INFRASTRUCTURE VMs
# ------------------------------------------------------------
virtual_machines:
  # --- SOVERSTACK RUNTIME ---
  - name: "soverstack-01"
    vm_id: 450
    host: "pve-01"
    type_definition: "management-std"
    role: "management"
${isMultiDc && isPrimaryDc ? `
  # --- PROXMOX DATACENTER MANAGER (Multi-DC only) ---
  - name: "pve-manager-01"
    vm_id: 451
    host: "pve-01"
    type_definition: "management-std"
    role: "management"
` : ""}
  # --- FIREWALL (VyOS) ---
${isLocal ? `  - name: "vyos-01"
    vm_id: 1
    host: "pve-01"
    type_definition: "firewall-std"
    role: "firewall"` : `  - name: "vyos-01"
    vm_id: 1
    host: "pve-01"
    type_definition: "firewall-std"
    role: "firewall"
  - name: "vyos-02"
    vm_id: 2
    host: "pve-02"
    type_definition: "firewall-std"
    role: "firewall"`}

  # --- VPN (Headscale) ---
${isLocal ? `  - name: "headscale-01"
    vm_id: 100
    host: "pve-01"
    type_definition: "vpn-std"
    role: "vpn"` : `  - name: "headscale-01"
    vm_id: 100
    host: "pve-01"
    type_definition: "vpn-std"
    role: "vpn"
  - name: "headscale-02"
    vm_id: 101
    host: "pve-02"
    type_definition: "vpn-std"
    role: "vpn"`}

  # --- DNS (PowerDNS + dnsdist) ---
${isLocal ? `  - name: "dns-01"
    vm_id: 200
    host: "pve-01"
    type_definition: "dns-std"
    role: "dns"` : `  - name: "dns-01"
    vm_id: 200
    host: "pve-01"
    type_definition: "dns-std"
    role: "dns"
  - name: "dns-02"
    vm_id: 201
    host: "pve-02"
    type_definition: "dns-std"
    role: "dns"`}

  # --- DATABASE (PostgreSQL + Patroni) ---
${isLocal ? `  - name: "postgres-01"
    vm_id: 250
    host: "pve-01"
    type_definition: "database-std"
    role: "database"` : `  - name: "postgres-01"
    vm_id: 250
    host: "pve-01"
    type_definition: "database-std"
    role: "database"
  - name: "postgres-02"
    vm_id: 251
    host: "pve-02"
    type_definition: "database-std"
    role: "database"
  - name: "postgres-03"
    vm_id: 252
    host: "pve-03"
    type_definition: "database-std"
    role: "database"`}

  # --- SECURITY (Keycloak) ---
${isLocal ? `  - name: "keycloak-01"
    vm_id: 300
    host: "pve-01"
    type_definition: "security-std"
    role: "iam"` : `  - name: "keycloak-01"
    vm_id: 300
    host: "pve-01"
    type_definition: "security-std"
    role: "iam"
  - name: "keycloak-02"
    vm_id: 301
    host: "pve-02"
    type_definition: "security-std"
    role: "iam"`}

  # --- SECURITY (OpenBao/Vault) ---
${isLocal ? `  - name: "openbao-01"
    vm_id: 310
    host: "pve-01"
    type_definition: "security-std"
    role: "secrets"` : `  - name: "openbao-01"
    vm_id: 310
    host: "pve-01"
    type_definition: "security-std"
    role: "secrets"
  - name: "openbao-02"
    vm_id: 311
    host: "pve-02"
    type_definition: "security-std"
    role: "secrets"
  - name: "openbao-03"
    vm_id: 312
    host: "pve-03"
    type_definition: "security-std"
    role: "secrets"`}

  # --- OBSERVABILITY (Prometheus) ---
${isLocal ? `  - name: "prometheus-01"
    vm_id: 350
    host: "pve-01"
    type_definition: "monitoring-std"
    role: "monitoring"` : `  - name: "prometheus-01"
    vm_id: 350
    host: "pve-01"
    type_definition: "monitoring-std"
    role: "monitoring"
  - name: "prometheus-02"
    vm_id: 351
    host: "pve-02"
    type_definition: "monitoring-std"
    role: "monitoring"`}

  # --- OBSERVABILITY (Grafana) ---
${isLocal ? `  - name: "grafana-01"
    vm_id: 360
    host: "pve-01"
    type_definition: "monitoring-std"
    role: "dashboards"` : `  - name: "grafana-01"
    vm_id: 360
    host: "pve-01"
    type_definition: "monitoring-std"
    role: "dashboards"
  - name: "grafana-02"
    vm_id: 361
    host: "pve-02"
    type_definition: "monitoring-std"
    role: "dashboards"`}

  # --- OBSERVABILITY (Loki) ---
${isLocal ? `  - name: "loki-01"
    vm_id: 370
    host: "pve-01"
    type_definition: "monitoring-std"
    role: "logging"` : `  - name: "loki-01"
    vm_id: 370
    host: "pve-01"
    type_definition: "monitoring-std"
    role: "logging"
  - name: "loki-02"
    vm_id: 371
    host: "pve-02"
    type_definition: "monitoring-std"
    role: "logging"
  - name: "loki-03"
    vm_id: 372
    host: "pve-03"
    type_definition: "monitoring-std"
    role: "logging"`}
`;

  fs.writeFileSync(filePath, content);
};
