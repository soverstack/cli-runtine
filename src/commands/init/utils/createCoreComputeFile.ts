import { InitOptions, getPrimaryZone } from "./index";
import fs from "fs";
import path from "path";

/**
 * Creates the GLOBAL core-compute.yaml file.
 *
 * Global VMs are deployed on control_plane_runs_on zone.
 * They are unique across ALL regions.
 *
 * VM ID Ranges (by group):
 *   EDGE (1-99): PowerDNS, dnsdist
 *   SECURITY (100-199): Headscale, Vault
 *   IAM_DATA (200-299): Keycloak, PostgreSQL
 *   OBSERVABILITY (300-399): Grafana
 *   INFRA (400-499): Soverstack, PDM
 *
 * NOT in this file (regional):
 *   - Prometheus, Loki, Alertmanager → regions/{region}/core-compute.yaml
 *   - VyOS, HAProxy → regions/{region}/zones/{zone}/core-compute.yaml
 *
 * OPTIONAL (deploy in K8s or add manually):
 *   - Harbor, Gitea, Uptime Kuma
 */
export const createCoreComputeFile = (options: InitOptions): void => {
  const { projectName, infrastructureTier, outputDir } = options;
  const targetDir = outputDir || path.resolve(process.cwd(), projectName);
  const filePath = path.join(targetDir, "compute.yaml");
  const primaryZone = getPrimaryZone(options);

  const isLocal = infrastructureTier === "local";

  const content = `# ════════════════════════════════════════════════════════════════════════════
# GLOBAL COMPUTE - INFRASTRUCTURE VMs
# ════════════════════════════════════════════════════════════════════════════
#
# Global VMs deployed on control_plane_runs_on zone (${primaryZone}).
# These services are unique across ALL regions.
#
# NOT in this file (regional/zone-specific):
#   - Prometheus, Loki, Alertmanager → regions/{region}/core-compute.yaml
#   - VyOS, HAProxy → regions/{region}/zones/{zone}/core-compute.yaml
#
# OPTIONAL (deploy in K8s or add manually):
#   - Harbor (registry) → use ghcr.io or deploy in K8s
#   - Gitea (git) → use GitHub or deploy in K8s
#   - Uptime Kuma (status page) → deploy in K8s
#
# VM ID Ranges (by group):
#   EDGE (1-99):            PowerDNS, dnsdist
#   SECURITY (100-199):     Headscale, Vault
#   IAM_DATA (200-299):     Keycloak, PostgreSQL
#   OBSERVABILITY (300-399): Grafana
#   INFRA (400-499):        Soverstack, PDM
#
# ════════════════════════════════════════════════════════════════════════════

# ────────────────────────────────────────────────────────────────────────────
# INSTANCE TYPE DEFINITIONS
# ────────────────────────────────────────────────────────────────────────────

instance_type_definitions:
  - name: edge-std
    cpu: 2
    ram: 2048
    disk: 20
    disk_type: distributed
    os_template: debian-12-cloudinit

  - name: security-std
    cpu: 4
    ram: 4096
    disk: 50
    disk_type: distributed
    os_template: debian-12-cloudinit

  - name: iam-std
    cpu: 4
    ram: 8192
    disk: 50
    disk_type: distributed
    os_template: debian-12-cloudinit

  - name: database-std
    cpu: 4
    ram: 8192
    disk: 100
    disk_type: distributed
    os_template: debian-12-cloudinit

  - name: observability-std
    cpu: 2
    ram: 4096
    disk: 50
    disk_type: distributed
    os_template: debian-12-cloudinit

  - name: infra-std
    cpu: 2
    ram: 4096
    disk: 40
    disk_type: distributed
    os_template: debian-12-cloudinit

# ────────────────────────────────────────────────────────────────────────────
# GLOBAL VMs
# ────────────────────────────────────────────────────────────────────────────

virtual_machines:

  # ═══════════════════════════════════════════════════════════════════════════
  # EDGE (1-99) - DNS
  # ═══════════════════════════════════════════════════════════════════════════
${isLocal ? `  - name: powerdns-01
    vm_id: 50
    host: pve-${primaryZone}-01
    type_definition: edge-std
    role: dns
    labels:
      service: powerdns

  - name: dnsdist-01
    vm_id: 60
    host: pve-${primaryZone}-01
    type_definition: edge-std
    role: dns-lb
    labels:
      service: dnsdist` : `  - name: powerdns-01
    vm_id: 50
    host: pve-${primaryZone}-01
    type_definition: edge-std
    role: dns
    labels:
      service: powerdns

  - name: powerdns-02
    vm_id: 51
    host: pve-${primaryZone}-02
    type_definition: edge-std
    role: dns
    labels:
      service: powerdns

  - name: dnsdist-01
    vm_id: 60
    host: pve-${primaryZone}-01
    type_definition: edge-std
    role: dns-lb
    labels:
      service: dnsdist

  - name: dnsdist-02
    vm_id: 61
    host: pve-${primaryZone}-02
    type_definition: edge-std
    role: dns-lb
    labels:
      service: dnsdist`}

  # ═══════════════════════════════════════════════════════════════════════════
  # SECURITY (100-199) - VPN, Secrets
  # ═══════════════════════════════════════════════════════════════════════════
${isLocal ? `  - name: headscale-01
    vm_id: 100
    host: pve-${primaryZone}-01
    type_definition: security-std
    role: vpn
    labels:
      service: headscale

  - name: vault-01
    vm_id: 150
    host: pve-${primaryZone}-01
    type_definition: security-std
    role: secrets
    labels:
      service: vault` : `  - name: headscale-01
    vm_id: 100
    host: pve-${primaryZone}-01
    type_definition: security-std
    role: vpn
    labels:
      service: headscale

  - name: headscale-02
    vm_id: 101
    host: pve-${primaryZone}-02
    type_definition: security-std
    role: vpn
    labels:
      service: headscale

  - name: vault-01
    vm_id: 150
    host: pve-${primaryZone}-01
    type_definition: security-std
    role: secrets
    labels:
      service: vault

  - name: vault-02
    vm_id: 151
    host: pve-${primaryZone}-02
    type_definition: security-std
    role: secrets
    labels:
      service: vault

  - name: vault-03
    vm_id: 152
    host: pve-${primaryZone}-03
    type_definition: security-std
    role: secrets
    labels:
      service: vault`}

  # ═══════════════════════════════════════════════════════════════════════════
  # IAM_DATA (200-299) - Identity, Database
  # ═══════════════════════════════════════════════════════════════════════════
${isLocal ? `  - name: keycloak-01
    vm_id: 200
    host: pve-${primaryZone}-01
    type_definition: iam-std
    role: iam
    labels:
      service: keycloak

  - name: postgres-01
    vm_id: 250
    host: pve-${primaryZone}-01
    type_definition: database-std
    role: database
    labels:
      service: postgresql` : `  - name: keycloak-01
    vm_id: 200
    host: pve-${primaryZone}-01
    type_definition: iam-std
    role: iam
    labels:
      service: keycloak

  - name: keycloak-02
    vm_id: 201
    host: pve-${primaryZone}-02
    type_definition: iam-std
    role: iam
    labels:
      service: keycloak

  - name: postgres-01
    vm_id: 250
    host: pve-${primaryZone}-01
    type_definition: database-std
    role: database
    labels:
      service: postgresql

  - name: postgres-02
    vm_id: 251
    host: pve-${primaryZone}-02
    type_definition: database-std
    role: database
    labels:
      service: postgresql

  - name: postgres-03
    vm_id: 252
    host: pve-${primaryZone}-03
    type_definition: database-std
    role: database
    labels:
      service: postgresql`}

  # ═══════════════════════════════════════════════════════════════════════════
  # OBSERVABILITY (300-399) - Dashboards
  # ═══════════════════════════════════════════════════════════════════════════
  - name: grafana-01
    vm_id: 310
    host: pve-${primaryZone}-01
    type_definition: observability-std
    role: dashboards
    labels:
      service: grafana

  # ═══════════════════════════════════════════════════════════════════════════
  # INFRA (400-499) - Controller
  # ═══════════════════════════════════════════════════════════════════════════
  - name: soverstack-01
    vm_id: 450
    host: pve-${primaryZone}-01
    type_definition: infra-std
    role: controller
    labels:
      service: soverstack
${isLocal ? "" : `
  - name: pdm-01
    vm_id: 455
    host: pve-${primaryZone}-01
    type_definition: infra-std
    role: management
    labels:
      service: pdm`}
`;

  fs.writeFileSync(filePath, content);
};
