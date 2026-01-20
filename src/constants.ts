// ═══════════════════════════════════════════════════════════════════════════
// SOVERSTACK RUNTIME - CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

// ───────────────────────────────────────────────────────────────────────────
// VM ID RANGES - Reserved ranges for different VM roles
// ───────────────────────────────────────────────────────────────────────────
export const VM_ID_RANGES = {
  // EDGE & NETWORK
  FIREWALL: { min: 1, max: 49, description: "VyOS, OPNsense" },
  DNS_LB: { min: 50, max: 69, description: "dnsdist" },
  DNS_SERVER: { min: 70, max: 99, description: "PowerDNS" },

  // ZERO-TRUST & SECURITY
  BASTION: { min: 100, max: 149, description: "Headscale, WireGuard" },
  SECRETS: { min: 150, max: 199, description: "OpenBao, Vault" },
  IAM_SSO: { min: 200, max: 249, description: "Keycloak, Authentik" },

  // DATA
  DATABASE: { min: 250, max: 279, description: "PostgreSQL" },
  CACHE: { min: 280, max: 299, description: "Redis, Valkey" },

  // OBSERVABILITY
  MONITORING: { min: 300, max: 319, description: "Prometheus" },
  ALERTING: { min: 320, max: 329, description: "Alertmanager" },
  DASHBOARDS: { min: 330, max: 349, description: "Grafana" },
  LOGGING: { min: 350, max: 369, description: "Loki" },
  SIEM: { min: 370, max: 399, description: "Wazuh, Falco" },

  // LOAD BALANCING
  LOAD_BALANCER: { min: 400, max: 449, description: "HAProxy, Nginx" },

  // TOOLS & MISC
  TOOLS: { min: 450, max: 469, description: "Pentest, Soverstack" },
  CI_CD: { min: 470, max: 499, description: "Runners, PBS" },

  // KUBERNETES
  K8S_MASTER: { min: 500, max: 599, description: "K8s control plane" },
  K8S_WORKER: { min: 600, max: 3000, description: "K8s workers" },

  // APPLICATIONS
  APPLICATIONS: { min: 3001, max: 99999, description: "Custom apps" },
} as const;

// ───────────────────────────────────────────────────────────────────────────
// HA REQUIREMENTS - By infrastructure tier
// ───────────────────────────────────────────────────────────────────────────
export const HA_REQUIREMENTS = {
  local: {
    min_servers: 1,
    min_db_nodes: 1,
    min_k8s_masters: 1,
    min_k8s_workers: 1,
    min_firewall_vms: 1,
    min_vpn_vms: 1,
    ha_required: false,
  },
  production: {
    min_servers: 3,
    min_db_nodes: 3,
    min_k8s_masters: 3,
    min_k8s_workers: 2,
    min_firewall_vms: 2,
    min_vpn_vms: 2,
    ha_required: true,
  },
  enterprise: {
    min_servers: 3,
    min_db_nodes: 3,
    min_k8s_masters: 3,
    min_k8s_workers: 3,
    min_firewall_vms: 2,
    min_vpn_vms: 2,
    ha_required: true,
  },
} as const;

// ───────────────────────────────────────────────────────────────────────────
// OS TEMPLATES - Supported cloud-init templates
// ───────────────────────────────────────────────────────────────────────────
export const OS_TEMPLATES = [
  "debian-12-cloudinit",
  "ubuntu-20.04-cloudinit",
  "ubuntu-24.04-cloudinit",
] as const;

// ───────────────────────────────────────────────────────────────────────────
// SOVERSTACK VERSION
// ───────────────────────────────────────────────────────────────────────────
export const SOVERSTACK_VERSION = "1.0.0";

// ───────────────────────────────────────────────────────────────────────────
// COMPLIANCE LEVELS
// ───────────────────────────────────────────────────────────────────────────
// Based on compliance level, certain security and HA choices are automatic.
// Not all projects need enterprise-grade security - choose what fits your needs.

export const COMPLIANCE_LEVELS = ["startup", "business", "enterprise", "regulated"] as const;

export const REGULATION_TYPES = [
  "pci-dss",
  "soc2",
  "hds",
  "gdpr",
  "iso27001",
  "hipaa",
] as const;

/**
 * Describes what each compliance level implies for security/HA
 * Written in non-technical language for better understanding
 */
export const COMPLIANCE_DESCRIPTIONS = {
  startup: {
    label: "Essential",
    description: "Side project, prototype - Basic security, simple and lightweight",
    implications: [
      "Basic monitoring (is it running?)",
      "No audit logging",
      "Simple backups",
    ],
  },
  business: {
    label: "Standard",
    description: "SMB, SaaS - Proper security for real users",
    implications: [
      "Audit logs (who did what, 30 days)",
      "MFA required",
      "Encrypted backups",
    ],
  },
  enterprise: {
    label: "Advanced",
    description: "Large company - Enhanced monitoring, controlled access",
    implications: [
      "Full audit logs sent to SIEM (90 days)",
      "Server access only via bastion",
      "Intrusion detection",
      "File integrity monitoring",
    ],
  },
  regulated: {
    label: "Regulated",
    description: "Bank, Healthcare - Maximum security, audit-ready",
    implications: [
      "All Advanced features +",
      "Logs kept for 1 year",
      "Dual approval for critical actions",
      "24/7 monitoring",
      "Automated compliance reports",
    ],
  },
} as const;

/**
 * Default compliance requirements per level
 * These are used by validators and generators to enforce security policies
 */
export const COMPLIANCE_DEFAULTS = {
  startup: {
    audit_enabled: false,
    audit_retention_days: 7,
    siem_integration: false,
    bastion_required: false,
    mfa_required: false,
    encryption_at_rest: false,
    file_integrity_monitoring: false,
    network_ids: false,
  },
  business: {
    audit_enabled: true,
    audit_retention_days: 30,
    siem_integration: false,
    bastion_required: false,
    mfa_required: true,
    encryption_at_rest: true,
    file_integrity_monitoring: false,
    network_ids: false,
  },
  enterprise: {
    audit_enabled: true,
    audit_retention_days: 90,
    siem_integration: true,
    bastion_required: true,
    mfa_required: true,
    encryption_at_rest: true,
    file_integrity_monitoring: true,
    network_ids: true,
  },
  regulated: {
    audit_enabled: true,
    audit_retention_days: 365,
    siem_integration: true,
    bastion_required: true,
    mfa_required: true,
    encryption_at_rest: true,
    file_integrity_monitoring: true,
    network_ids: true,
    hsm_required: true,
    four_eyes_principle: true,
    soc_24_7: true,
  },
} as const;
