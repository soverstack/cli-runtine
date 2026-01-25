import { InitOptions, RegionConfig } from "./index";
import fs from "fs";
import path from "path";

export interface RegionFileOptions extends InitOptions {
  regionDir: string;
  regionConfig: RegionConfig;
}

/**
 * Create all files for a region:
 * - regions/{region}/region.yaml
 * - regions/{region}/observability.yaml
 * - regions/{region}/compute.yaml
 * - regions/{region}/hub/backup.yaml
 * - regions/{region}/hub/compute.yaml
 * - regions/{region}/zones/{zone}/datacenter.yaml
 * - regions/{region}/zones/{zone}/networking.yaml
 * - regions/{region}/zones/{zone}/compute.yaml
 */
export const createRegionFile = ({
  infrastructureTier,
  regionDir,
  regionConfig,
}: RegionFileOptions): void => {
  const tier = infrastructureTier || "production";
  const regionName = regionConfig.name;
  const zones = regionConfig.zones;
  const primaryZone = zones[0];

  // Hub is always created, but enabled only for production/enterprise
  const isHubEnabled = tier === "production" || tier === "enterprise";

  // Create region directory structure
  const regionPath = path.join(regionDir, regionName);
  const hubPath = path.join(regionPath, "hub");
  const zonesPath = path.join(regionPath, "zones");

  fs.mkdirSync(regionPath, { recursive: true });
  fs.mkdirSync(hubPath, { recursive: true });
  zones.forEach((zone) => {
    fs.mkdirSync(path.join(zonesPath, zone), { recursive: true });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. region.yaml
  // ═══════════════════════════════════════════════════════════════════════════

  // Build unified datacenters list (hub + zones)
  const hubEntry = `  - name: hub-${regionName}
    type: hub                             # Backup & storage (HDD)
    enabled: ${isHubEnabled}
    datacenter: ./hub/datacenter.yaml
    networking: ./hub/networking.yaml
    compute: ./hub/compute.yaml`;

  const zonesEntries = zones
    .map(
      (zone) => `  - name: ${zone}
    type: zone                            # Production (NVMe + Ceph)
    datacenter: ./zones/${zone}/datacenter.yaml
    networking: ./zones/${zone}/networking.yaml
    compute: ./zones/${zone}/compute.yaml`
    )
    .join("\n\n");

  const regionYaml = `# ════════════════════════════════════════════════════════════════════════════
# REGION CONFIGURATION - ${regionName.toUpperCase()}
# ════════════════════════════════════════════════════════════════════════════
#
# A region is a geographic area containing:
#   - Regional services (Prometheus, Loki, Teleport, Wazuh)
#   - Datacenters: Hub (HDD backup) + Zones (NVMe production)
#
# ════════════════════════════════════════════════════════════════════════════

name: ${regionName}
description: ""

# ════════════════════════════════════════════════════════════════════════════
# REGIONAL SERVICES
# ════════════════════════════════════════════════════════════════════════════
# Services deployed once per region (GDPR: data stays in region).
# VMs run on the control_plane datacenter.

security: ./security.yaml                 # Teleport, Wazuh
observability: ./observability.yaml       # Prometheus, Loki, Alertmanager

# Where regional VMs are deployed
control_plane: ${primaryZone}

# ════════════════════════════════════════════════════════════════════════════
# DATACENTERS
# ════════════════════════════════════════════════════════════════════════════
# List of Proxmox clusters in this region.
# - type: hub  → HDD storage for backup (PBS, MinIO)
# - type: zone → NVMe + Ceph for production workloads
#
datacenters:
${hubEntry}

${zonesEntries}
`;

  fs.writeFileSync(path.join(regionPath, "region.yaml"), regionYaml);

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. regions/{region}/observability.yaml
  // ═══════════════════════════════════════════════════════════════════════════
  const isLocal = tier === "local";

  // HA: 2 VMs for production, 1 for local
  const prometheusVmIds = isLocal ? "[300]" : "[300, 301]";
  const lokiVmIds = isLocal ? "[320]" : "[320, 321]";
  const alertmanagerVmIds = isLocal ? "[330]" : "[330, 331]";

  const regionObservabilityYaml = `# ════════════════════════════════════════════════════════════════════════════
# REGIONAL OBSERVABILITY - ${regionName.toUpperCase()}
# ════════════════════════════════════════════════════════════════════════════
#
# Metrics collection for this region (GDPR: data stays in region).
# Connects to global Grafana for dashboards.
#
# VM ID Ranges:
#   Prometheus:   300-309
#   Loki:         320-329
#   Alertmanager: 330-339
#
# For detailed config, create: apps/prometheus.yaml, apps/loki.yaml
#
# ════════════════════════════════════════════════════════════════════════════

prometheus:
  vm_ids: ${prometheusVmIds}

loki:
  vm_ids: ${lokiVmIds}

alertmanager:
  vm_ids: ${alertmanagerVmIds}
`;

  fs.writeFileSync(
    path.join(regionPath, "observability.yaml"),
    regionObservabilityYaml
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. regions/{region}/compute.yaml (Regional VMs)
  // NOTE: security.yaml is generated by createRegionalSecurityFile.ts
  // ═══════════════════════════════════════════════════════════════════════════
  const regionComputeYaml = `# ════════════════════════════════════════════════════════════════════════════
# REGIONAL COMPUTE - ${regionName.toUpperCase()}
# ════════════════════════════════════════════════════════════════════════════
#
# Regional VMs deployed on: ${primaryZone}
# These services collect/store data for this region only.
#
# VM ID Ranges (by group):
#   SECURITY (100-199):      Teleport (SSH bastion)
#   OBSERVABILITY (300-399): Prometheus, Loki, Alertmanager, Wazuh
#
# ════════════════════════════════════════════════════════════════════════════

# ────────────────────────────────────────────────────────────────────────────
# INSTANCE TYPE DEFINITIONS
# ────────────────────────────────────────────────────────────────────────────

instance_type_definitions:
  - name: security-std
    cpu: 2
    ram: 4096
    disk: 50
    disk_type: distributed
    os_template: debian-12-cloudinit

  - name: observability-std
    cpu: 4
    ram: 8192
    disk: 100
    disk_type: distributed
    os_template: debian-12-cloudinit

  - name: observability-lg
    cpu: 4
    ram: 8192
    disk: 200
    disk_type: distributed
    os_template: debian-12-cloudinit

  - name: siem-std
    cpu: 4
    ram: 16384
    disk: 200
    disk_type: distributed
    os_template: debian-12-cloudinit

# ────────────────────────────────────────────────────────────────────────────
# REGIONAL VMs
# ────────────────────────────────────────────────────────────────────────────

virtual_machines:

  # ═══════════════════════════════════════════════════════════════════════════
  # SECURITY (100-199) - SSH Bastion (regional for GDPR compliance)
  # ═══════════════════════════════════════════════════════════════════════════
  # Teleport stores SSH session recordings - must stay in region for GDPR.
  # ${tier === "local" ? "Single instance for local dev." : "HA pair for zero-downtime."} Backend: PostgreSQL (global).
  #
  - name: teleport-${regionName}-01
    vm_id: 120
    host: pve-${primaryZone}-01
    type_definition: security-std
    role: bastion
    labels:
      service: teleport
      region: ${regionName}
${tier !== "local" ? `
  - name: teleport-${regionName}-02
    vm_id: 121
    host: pve-${primaryZone}-02
    type_definition: security-std
    role: bastion
    labels:
      service: teleport
      region: ${regionName}` : ""}

  # ═══════════════════════════════════════════════════════════════════════════
  # OBSERVABILITY (300-399) - Monitoring, Logging, Alerting, SIEM
  # ═══════════════════════════════════════════════════════════════════════════
  - name: prometheus-${regionName}-01
    vm_id: 300
    host: pve-${primaryZone}-01
    type_definition: observability-std
    role: monitoring
    labels:
      service: prometheus
      region: ${regionName}

  - name: loki-${regionName}-01
    vm_id: 320
    host: pve-${primaryZone}-02
    type_definition: observability-lg
    role: logging
    labels:
      service: loki
      region: ${regionName}

  - name: alertmanager-${regionName}-01
    vm_id: 330
    host: pve-${primaryZone}-03
    type_definition: observability-std
    role: alerting
    labels:
      service: alertmanager
      region: ${regionName}
    resources:
      cpu: 2
      ram: 4096
      disk: 20

  - name: wazuh-${regionName}-01
    vm_id: 340
    host: pve-${primaryZone}-01
    type_definition: siem-std
    role: siem
    labels:
      service: wazuh
      region: ${regionName}
${tier !== "local" ? `
  - name: wazuh-${regionName}-02
    vm_id: 341
    host: pve-${primaryZone}-02
    type_definition: siem-std
    role: siem
    labels:
      service: wazuh
      region: ${regionName}` : ""}

  - name: crowdsec-${regionName}-01
    vm_id: 345
    host: pve-${primaryZone}-01
    type_definition: security-std
    role: ids
    labels:
      service: crowdsec
      region: ${regionName}
`;

  fs.writeFileSync(
    path.join(regionPath, "compute.yaml"),
    regionComputeYaml
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. regions/{region}/hub/datacenter.yaml (same structure as zone)
  // ═══════════════════════════════════════════════════════════════════════════
  const hubNodeCount = tier === "local" ? 1 : 2;
  const hubServersYaml = Array.from({ length: hubNodeCount }, (_, i) => {
    const nodeNum = String(i + 1).padStart(2, "0");
    return `  - name: pve-hub-${regionName}-${nodeNum}
    ip: 10.100.0.${i + 1}
    role: ${i === 0 ? "primary" : "secondary"}
    storage:
      type: hdd
      ceph: false                         # No Ceph on hub (local HDD only)`;
  }).join("\n\n");

  const hubDatacenterYaml = `# ════════════════════════════════════════════════════════════════════════════
# HUB DATACENTER - ${regionName.toUpperCase()}
# ════════════════════════════════════════════════════════════════════════════
#
# Proxmox cluster with HDD storage for backup & archive.
# Same structure as a zone, but optimized for storage cost.
#
# ════════════════════════════════════════════════════════════════════════════

name: hub-${regionName}
region: ${regionName}
type: hub                                 # hub | zone
description: "Backup & storage datacenter"

# ────────────────────────────────────────────────────────────────────────────
# PROXMOX SERVERS
# ────────────────────────────────────────────────────────────────────────────
# HDD servers for cost-effective backup storage.

servers:
${hubServersYaml}

# ────────────────────────────────────────────────────────────────────────────
# STORAGE (local HDD, no Ceph)
# ────────────────────────────────────────────────────────────────────────────
# Hub uses local HDD storage, not Ceph.
# Redundancy via: PBS replication, MinIO distributed mode.

storage:
  type: local                             # local (no ceph)
`;

  fs.writeFileSync(path.join(hubPath, "datacenter.yaml"), hubDatacenterYaml);

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. regions/{region}/hub/networking.yaml (same structure as zone)
  // ═══════════════════════════════════════════════════════════════════════════
  const hubNetworkingYaml = `# ════════════════════════════════════════════════════════════════════════════
# HUB NETWORKING - ${regionName.toUpperCase()}
# ════════════════════════════════════════════════════════════════════════════
#
# Hub-specific networking. Same structure as zone networking.
# Hub doesn't need public IPs (accessed via VPN only).
#
# ════════════════════════════════════════════════════════════════════════════

cluster: hub-${regionName}
region: ${regionName}

# ────────────────────────────────────────────────────────────────────────────
# PUBLIC IPs (not needed for hub)
# ────────────────────────────────────────────────────────────────────────────
# Hub is accessed via VPN only - no public IPs required.

public_ips:
  type: none                              # Hub doesn't need public IPs

# ────────────────────────────────────────────────────────────────────────────
# HUB MESH NETWORKS
# ────────────────────────────────────────────────────────────────────────────
# Local to this hub - backup traffic stays isolated.

mesh_networks:
  - name: services
    subnet: 10.100.50.0/24
    port: 51826
    purpose: PBS, MinIO services

  - name: proxmox-public
    subnet: 10.100.30.0/24
    port: 51823
    purpose: Proxmox API/UI

  - name: proxmox-cluster
    subnet: 10.100.31.0/24
    port: 51824
    purpose: Corosync (if clustered)
`;

  fs.writeFileSync(path.join(hubPath, "networking.yaml"), hubNetworkingYaml);

  // ═══════════════════════════════════════════════════════════════════════════
  // 6. regions/{region}/hub/compute.yaml (Hub VMs)
  // ═══════════════════════════════════════════════════════════════════════════
  const hubComputeYaml = `# ════════════════════════════════════════════════════════════════════════════
# HUB COMPUTE - ${regionName.toUpperCase()}
# ════════════════════════════════════════════════════════════════════════════
#
# Hub VMs for backup & storage services.
#
# VM ID Ranges:
#   PBS:   2000-2009
#   MinIO: 2010-2019
#
# For detailed config, create: apps/pbs.yaml, apps/minio.yaml
#
# ════════════════════════════════════════════════════════════════════════════

pbs:
  vm_ids: [2000]
  subdomain: backup
  vpn_only: true

minio:
  vm_ids: [2010, 2011]
  subdomain: s3
  vpn_only: true
  admin:
    password:
      type: env
      var_name: MINIO_ROOT_PASSWORD
`;

  fs.writeFileSync(path.join(hubPath, "compute.yaml"), hubComputeYaml);

  // ═══════════════════════════════════════════════════════════════════════════
  // 6-8. Zone files (for each zone)
  // ═══════════════════════════════════════════════════════════════════════════
  zones.forEach((zone, index) => {
    const zonePath = path.join(zonesPath, zone);
    const nodeCount = tier === "local" ? 1 : 3;

    // 6. zones/{zone}/datacenter.yaml
    const serversYaml = Array.from({ length: nodeCount }, (_, i) => {
      const nodeNum = String(i + 1).padStart(2, "0");
      return `  - name: pve-${zone}-${nodeNum}
    ip: 10.${10 + index}.0.${i + 1}
    role: ${i === 0 ? "primary" : "secondary"}
    storage:
      type: nvme
      ceph: true`;
    }).join("\n\n");

    const datacenterYaml = `# ════════════════════════════════════════════════════════════════════════════
# ZONE DATACENTER - ${zone.toUpperCase()}
# ════════════════════════════════════════════════════════════════════════════
#
# Proxmox cluster with NVMe/Ceph storage for production workloads.
#
# ════════════════════════════════════════════════════════════════════════════

name: ${zone}
region: ${regionName}
type: zone                                # hub | zone
description: ""

# ────────────────────────────────────────────────────────────────────────────
# PROXMOX SERVERS
# ────────────────────────────────────────────────────────────────────────────

servers:
${serversYaml}

# ────────────────────────────────────────────────────────────────────────────
# CEPH STORAGE
# ────────────────────────────────────────────────────────────────────────────

ceph:
  enabled: ${tier !== "local"}
  pool_name: ${zone}-pool
  replicas: ${tier === "local" ? 1 : 3}
`;

    fs.writeFileSync(path.join(zonePath, "datacenter.yaml"), datacenterYaml);

    // 7. zones/{zone}/networking.yaml
    const networkingYaml = `# ════════════════════════════════════════════════════════════════════════════
# ZONE NETWORKING - ${zone.toUpperCase()}
# ════════════════════════════════════════════════════════════════════════════
#
# Zone-specific networking:
# - Public IPs (auto-assigned by Soverstack)
# - Zone mesh networks (local to this zone)
#
# Global networking (DNS, VPN, global mesh) → networking.yaml
#
# ════════════════════════════════════════════════════════════════════════════

zone: ${zone}
region: ${regionName}

# ────────────────────────────────────────────────────────────────────────────
# PUBLIC IPs
# ────────────────────────────────────────────────────────────────────────────
# Soverstack auto-assigns IPs to VMs based on role:
# - powerdns (if dns.type = powerdns)
# - vyos (firewall)
# - haproxy-edge (ingress)
# And configures VRRP failover automatically.
#
public_ips:
  type: allocated_block          # allocated_block | bgp

  # ─── type: allocated_block ───
  # Block assigned by datacenter (Hetzner, OVH, etc.)
  allocated_block:
    block: ""                    # REQUIRED - e.g., "203.0.113.0/29"
    gateway: ""                  # REQUIRED - e.g., "203.0.113.1"
    usable_range: ""             # REQUIRED - e.g., "203.0.113.2-203.0.113.6"

  # ─── type: bgp (coming soon) ───
  # bgp:
  #   asn: 210123
  #   ip_blocks:
  #     - 203.0.113.0/24

# ────────────────────────────────────────────────────────────────────────────
# ZONE MESH NETWORKS
# ────────────────────────────────────────────────────────────────────────────
# Local to this zone - never cross zone boundaries.
# Latency-critical networks (Ceph, Corosync).
#
mesh_networks:
  - name: services
    subnet: 10.50.${index}.0/24
    port: 51826
    purpose: VyOS, HAProxy, local services

  - name: ceph-public
    subnet: 10.20.${index}.0/24
    port: 51821
    purpose: VM I/O to Ceph

  - name: ceph-cluster
    subnet: 10.21.${index}.0/24
    port: 51822
    mtu: 8940
    purpose: Ceph replication (latency critical)

  - name: proxmox-public
    subnet: 10.30.${index}.0/24
    port: 51823
    purpose: Proxmox API/UI

  - name: proxmox-cluster
    subnet: 10.31.${index}.0/24
    port: 51824
    purpose: Corosync, live migration (latency critical)
`;

    fs.writeFileSync(path.join(zonePath, "networking.yaml"), networkingYaml);

    // 8. zones/{zone}/compute.yaml (Zone VMs)
    const zoneComputeYaml = `# ════════════════════════════════════════════════════════════════════════════
# ZONE COMPUTE - ${zone.toUpperCase()}
# ════════════════════════════════════════════════════════════════════════════
#
# Zone-specific VMs (firewall, load balancer).
#
# VM ID Ranges (by group):
#   EDGE (1-99):   VyOS (firewall/router)
#   INFRA (400-499): HAProxy (load balancer)
#
# ════════════════════════════════════════════════════════════════════════════

# ────────────────────────────────────────────────────────────────────────────
# INSTANCE TYPE DEFINITIONS
# ────────────────────────────────────────────────────────────────────────────

instance_type_definitions:
  - name: edge-std
    cpu: 2
    ram: 2048
    disk: 10
    disk_type: distributed
    os_template: vyos-1.4-cloudinit

  - name: infra-std
    cpu: 2
    ram: 4096
    disk: 20
    disk_type: distributed
    os_template: debian-12-cloudinit

# ────────────────────────────────────────────────────────────────────────────
# ZONE VMs
# ────────────────────────────────────────────────────────────────────────────

virtual_machines:

  # ═══════════════════════════════════════════════════════════════════════════
  # EDGE (1-99) - Firewall/Router
  # ═══════════════════════════════════════════════════════════════════════════
  - name: vyos-${zone}-01
    vm_id: ${1 + index * 10}
    host: pve-${zone}-01
    type_definition: edge-std
    role: firewall
    labels:
      service: vyos
      zone: ${zone}

  # ═══════════════════════════════════════════════════════════════════════════
  # INFRA (400-499) - Load Balancers
  # ═══════════════════════════════════════════════════════════════════════════
  - name: haproxy-edge-${zone}-01
    vm_id: ${400 + index * 10}
    host: pve-${zone}-01
    type_definition: infra-std
    role: loadbalancer
    labels:
      service: haproxy
      type: edge
      zone: ${zone}

  - name: haproxy-edge-${zone}-02
    vm_id: ${401 + index * 10}
    host: pve-${zone}-02
    type_definition: infra-std
    role: loadbalancer
    labels:
      service: haproxy
      type: edge
      zone: ${zone}

  - name: haproxy-k8s-${zone}-01
    vm_id: ${410 + index * 10}
    host: pve-${zone}-01
    type_definition: infra-std
    role: loadbalancer
    labels:
      service: haproxy
      type: k8s-api
      zone: ${zone}
`;

    fs.writeFileSync(path.join(zonePath, "compute.yaml"), zoneComputeYaml);
  });
};
