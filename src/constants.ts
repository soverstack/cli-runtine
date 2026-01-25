// ═══════════════════════════════════════════════════════════════════════════
// SOVERSTACK RUNTIME - CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

// ───────────────────────────────────────────────────────────────────────────
// VM ID RANGES - Reserved ranges by functional group
// ───────────────────────────────────────────────────────────────────────────
//
// STRUCTURE:
//   1-99:      EDGE          - VyOS, PowerDNS, dnsdist
//   100-199:   SECURITY      - Headscale, Teleport, Vault, CrowdSec
//   200-299:   IAM_DATA      - Keycloak, PostgreSQL
//   300-399:   OBSERVABILITY - Grafana (global) + Prometheus, Loki, Alertmanager, Wazuh (regional)
//   400-499:   INFRA         - HAProxy, Soverstack, PDM
//   500-1999:  KUBERNETES    - Masters (500-599), Workers (600-1999)
//   2000-2999: BACKUP        - PBS, MinIO (Hub only)
//   3000+:     APPLICATIONS  - Custom apps
//
// ───────────────────────────────────────────────────────────────────────────
export const VM_ID_RANGES = {
  EDGE: { min: 1, max: 99, description: "VyOS, PowerDNS, dnsdist" },
  SECURITY: { min: 100, max: 199, description: "Headscale, Teleport, Vault, CrowdSec" },
  IAM_DATA: { min: 200, max: 299, description: "Keycloak, PostgreSQL" },
  OBSERVABILITY: { min: 300, max: 399, description: "Grafana (global), Prometheus, Loki, Alertmanager, Wazuh (regional)" },
  INFRA: { min: 400, max: 499, description: "HAProxy, Soverstack, PDM" },
  KUBERNETES: { min: 500, max: 1999, description: "K8s Masters (500-599), Workers (600-1999)" },
  BACKUP: { min: 2000, max: 2999, description: "PBS, MinIO (Hub only)" },
  APPLICATIONS: { min: 3000, max: 99999, description: "Custom apps" },
} as const;

// ───────────────────────────────────────────────────────────────────────────
// HA REQUIREMENTS - By infrastructure tier
// ───────────────────────────────────────────────────────────────────────────
export const HA_REQUIREMENTS = {
  local: {
    // Infrastructure
    min_servers: 1,
    ha_required: false,
    hub_required: false,
    // Edge
    min_firewall_vms: 1,
    min_dns_vms: 1,
    // Zero-Trust
    min_vpn_vms: 1,
    min_ssh_bastion_vms: 0,
    min_secrets_vms: 1,
    min_iam_vms: 1,
    // Data
    min_db_nodes: 1,
    // Observability
    min_prometheus_vms: 1,
    min_grafana_vms: 1,
    // Kubernetes (optional)
    min_k8s_masters: 0,
    min_k8s_workers: 0,
  },
  production: {
    // Infrastructure
    min_servers: 3,
    ha_required: true,
    hub_required: true,
    // Edge
    min_firewall_vms: 2,
    min_dns_vms: 2,
    // Zero-Trust
    min_vpn_vms: 2,
    min_ssh_bastion_vms: 2,
    min_secrets_vms: 3,
    min_iam_vms: 2,
    // Data
    min_db_nodes: 3,
    // Observability
    min_prometheus_vms: 1,
    min_grafana_vms: 1,
    // Kubernetes (optional)
    min_k8s_masters: 3,
    min_k8s_workers: 3,
  },
  enterprise: {
    // Infrastructure
    min_servers: 5,
    ha_required: true,
    hub_required: true,
    // Edge
    min_firewall_vms: 2,
    min_dns_vms: 2,
    // Zero-Trust
    min_vpn_vms: 2,
    min_ssh_bastion_vms: 2,
    min_secrets_vms: 3,
    min_iam_vms: 2,
    // Data
    min_db_nodes: 3,
    // Observability
    min_prometheus_vms: 2,
    min_grafana_vms: 1,
    // Kubernetes (optional)
    min_k8s_masters: 3,
    min_k8s_workers: 5,
  },
} as const;

// ───────────────────────────────────────────────────────────────────────────
// COMPLIANCE DESCRIPTIONS - Security level labels
// ───────────────────────────────────────────────────────────────────────────
export const COMPLIANCE_DESCRIPTIONS = {
  startup: {
    label: "Essential",
    description: "Basic security for prototypes and personal projects",
  },
  business: {
    label: "Standard",
    description: "Production-ready security for SaaS and web apps",
  },
  enterprise: {
    label: "Advanced",
    description: "Enterprise security with audit trails and SSO",
  },
  regulated: {
    label: "Regulated",
    description: "Maximum security for banks, healthcare, government",
  },
} as const;

// ───────────────────────────────────────────────────────────────────────────
// INFRASTRUCTURE TIERS
// ───────────────────────────────────────────────────────────────────────────
export const INFRASTRUCTURE_TIERS = ["local", "production", "enterprise"] as const;

// ───────────────────────────────────────────────────────────────────────────
// DEFAULT VALUES
// ───────────────────────────────────────────────────────────────────────────
export const DEFAULTS = {
  project_name: "my-soverstack-project",
  domain: "example.com",
  infrastructure_tier: "production",
  compliance_level: "startup",
  region: "eu",
  zone: "main",
} as const;
