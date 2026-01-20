// ───────────────────────────────────────────────────────────────────────────
// INFRASTRUCTURE REQUIREMENTS - VM specs by tier and role
// ───────────────────────────────────────────────────────────────────────────

import { VM_ID_RANGES } from "./constants";

export const INFRASTRUCTURE_REQUIREMENTS = {
  // VM SPECIFICATIONS BY ROLE AND TIER
  vms: {
    // EDGE (Network Entry)
    vyos: {
      role: "firewall" as const,
      vm_id_range: "FIREWALL" as const,
      ha_mechanism: "VRRP",
      min_count: { local: 1, production: 2, enterprise: 2 },
      specs: {
        local:      { vcpu: 2, ram_gb: 2,  disk_gb: 20 },
        production: { vcpu: 4, ram_gb: 4,  disk_gb: 20 },
        enterprise: { vcpu: 8, ram_gb: 8,  disk_gb: 20 },
      },
    },
    haproxy: {
      role: "load_balancer" as const,
      vm_id_range: "LOAD_BALANCER" as const,
      ha_mechanism: "Keepalived",
      min_count: { local: 0, production: 2, enterprise: 2 },
      specs: {
        local:      { vcpu: 1, ram_gb: 2,  disk_gb: 20 },
        production: { vcpu: 2, ram_gb: 4,  disk_gb: 20 },
        enterprise: { vcpu: 4, ram_gb: 8,  disk_gb: 20 },
      },
    },

    // ZERO-TRUST (Security & Identity)
    headscale: {
      role: "bastion" as const,
      vm_id_range: "BASTION" as const,
      ha_mechanism: "LB + shared DB",
      min_count: { local: 1, production: 2, enterprise: 3 },
      specs: {
        local:      { vcpu: 1, ram_gb: 2,  disk_gb: 20 },
        production: { vcpu: 2, ram_gb: 4,  disk_gb: 40 },
        enterprise: { vcpu: 4, ram_gb: 8,  disk_gb: 40 },
      },
    },
    keycloak: {
      role: "iam_sso" as const,
      vm_id_range: "IAM_SSO" as const,
      ha_mechanism: "Infinispan cluster",
      min_count: { local: 1, production: 2, enterprise: 3 },
      specs: {
        local:      { vcpu: 2, ram_gb: 4,  disk_gb: 40 },
        production: { vcpu: 4, ram_gb: 8,  disk_gb: 40 },
        enterprise: { vcpu: 4, ram_gb: 16, disk_gb: 60 },
      },
    },
    openbao: {
      role: "secrets" as const,
      vm_id_range: "SECRETS" as const,
      ha_mechanism: "Raft consensus",
      min_count: { local: 1, production: 2, enterprise: 3 },
      specs: {
        local:      { vcpu: 1, ram_gb: 2,  disk_gb: 20 },
        production: { vcpu: 2, ram_gb: 4,  disk_gb: 40 },
        enterprise: { vcpu: 2, ram_gb: 4,  disk_gb: 40 },
      },
    },

    // DNS
    dnsdist: {
      role: "dns_lb" as const,
      vm_id_range: "DNS_LB" as const,
      ha_mechanism: "Keepalived",
      min_count: { local: 0, production: 2, enterprise: 2 },
      specs: {
        local:      { vcpu: 1, ram_gb: 1,  disk_gb: 10 },
        production: { vcpu: 2, ram_gb: 4,  disk_gb: 20 },
        enterprise: { vcpu: 2, ram_gb: 4,  disk_gb: 20 },
      },
    },
    powerdns: {
      role: "dns_server" as const,
      vm_id_range: "DNS_SERVER" as const,
      ha_mechanism: "LB + shared DB",
      min_count: { local: 1, production: 2, enterprise: 3 },
      specs: {
        local:      { vcpu: 1, ram_gb: 2,  disk_gb: 20 },
        production: { vcpu: 2, ram_gb: 4,  disk_gb: 40 },
        enterprise: { vcpu: 2, ram_gb: 4,  disk_gb: 40 },
      },
    },

    // DATA (Databases)
    postgresql: {
      role: "database" as const,
      vm_id_range: "DATABASE" as const,
      ha_mechanism: "Patroni + etcd",
      min_count: { local: 1, production: 3, enterprise: 3 },
      specs: {
        local:      { vcpu: 2, ram_gb: 4,   disk_gb: 50 },
        production: { vcpu: 4, ram_gb: 8,   disk_gb: 150 },
        enterprise: { vcpu: 8, ram_gb: 16,  disk_gb: 300 },
      },
    },
    redis: {
      role: "cache" as const,
      vm_id_range: "CACHE" as const,
      ha_mechanism: "Sentinel",
      min_count: { local: 0, production: 3, enterprise: 3 },
      specs: {
        local:      { vcpu: 1, ram_gb: 2,  disk_gb: 10 },
        production: { vcpu: 2, ram_gb: 8,  disk_gb: 20 },
        enterprise: { vcpu: 2, ram_gb: 16, disk_gb: 40 },
      },
    },

    // MONITORING
    prometheus: {
      role: "monitoring" as const,
      vm_id_range: "MONITORING" as const,
      ha_mechanism: "Dual scrape",
      min_count: { local: 0, production: 2, enterprise: 2 },
      specs: {
        local:      { vcpu: 2, ram_gb: 4,   disk_gb: 50 },
        production: { vcpu: 4, ram_gb: 16,  disk_gb: 100 },
        enterprise: { vcpu: 4, ram_gb: 32,  disk_gb: 200 },
      },
    },
    alertmanager: {
      role: "alerting" as const,
      vm_id_range: "ALERTING" as const,
      ha_mechanism: "Gossip cluster",
      min_count: { local: 0, production: 2, enterprise: 3 },
      specs: {
        local:      { vcpu: 1, ram_gb: 1,  disk_gb: 10 },
        production: { vcpu: 2, ram_gb: 4,  disk_gb: 20 },
        enterprise: { vcpu: 2, ram_gb: 4,  disk_gb: 20 },
      },
    },
    grafana: {
      role: "dashboards" as const,
      vm_id_range: "DASHBOARDS" as const,
      ha_mechanism: "LB + shared DB",
      min_count: { local: 0, production: 2, enterprise: 2 },
      specs: {
        local:      { vcpu: 1, ram_gb: 2,  disk_gb: 20 },
        production: { vcpu: 2, ram_gb: 4,  disk_gb: 20 },
        enterprise: { vcpu: 2, ram_gb: 4,  disk_gb: 20 },
      },
    },

    // LOGGING & SECURITY
    loki: {
      role: "logging" as const,
      vm_id_range: "LOGGING" as const,
      ha_mechanism: "Memberlist",
      min_count: { local: 0, production: 2, enterprise: 3 },
      specs: {
        local:      { vcpu: 2, ram_gb: 4,   disk_gb: 50 },
        production: { vcpu: 4, ram_gb: 8,   disk_gb: 100 },
        enterprise: { vcpu: 4, ram_gb: 16,  disk_gb: 200 },
      },
    },
    wazuh: {
      role: "siem" as const,
      vm_id_range: "SIEM" as const,
      ha_mechanism: "Cluster mode",
      min_count: { local: 0, production: 1, enterprise: 2 },
      specs: {
        local:      { vcpu: 2, ram_gb: 4,  disk_gb: 50 },
        production: { vcpu: 4, ram_gb: 8,  disk_gb: 100 },
        enterprise: { vcpu: 4, ram_gb: 16, disk_gb: 200 },
      },
    },

    // TOOLS
    pentest: {
      role: "pentest" as const,
      vm_id_range: "TOOLS" as const,
      ha_mechanism: null,
      min_count: { local: 0, production: 0, enterprise: 1 },
      specs: {
        local:      { vcpu: 2, ram_gb: 4,  disk_gb: 40 },
        production: { vcpu: 4, ram_gb: 8,  disk_gb: 80 },
        enterprise: { vcpu: 4, ram_gb: 8,  disk_gb: 80 },
      },
    },
    soverstack: {
      role: "management" as const,
      vm_id_range: "TOOLS" as const,
      ha_mechanism: null,
      min_count: { local: 1, production: 1, enterprise: 1 },
      specs: {
        local:      { vcpu: 1, ram_gb: 2,  disk_gb: 20 },
        production: { vcpu: 1, ram_gb: 2,  disk_gb: 40 },
        enterprise: { vcpu: 1, ram_gb: 2,  disk_gb: 40 },
      },
    },
  },

  // MANDATORY DATABASES
  mandatory_databases: [
    { name: "soverstack", owner: "soverstack", purpose: "Runtime state and configuration" },
    { name: "keycloak",   owner: "keycloak",   purpose: "IAM/SSO authentication" },
    { name: "headscale",  owner: "headscale",  purpose: "VPN coordination DB" },
    { name: "powerdns",   owner: "powerdns",   purpose: "DNS zone records" },
    { name: "openbao",    owner: "openbao",    purpose: "Secrets audit logs" },
  ],

  // ROLE TO VM_ID_RANGE MAPPING
  role_to_range: {
    firewall: "FIREWALL",
    bastion: "BASTION",
    secrets: "SECRETS",
    iam_sso: "IAM_SSO",
    database: "DATABASE",
    cache: "CACHE",
    monitoring: "MONITORING",
    alerting: "ALERTING",
    dashboards: "DASHBOARDS",
    logging: "LOGGING",
    siem: "SIEM",
    load_balancer: "LOAD_BALANCER",
    dns_lb: "DNS_LB",
    dns_server: "DNS_SERVER",
    pentest: "TOOLS",
    management: "TOOLS",
    k8s_master: "K8S_MASTER",
    k8s_worker: "K8S_WORKER",
    ci_runner: "CI_CD",
    general_purpose: "APPLICATIONS",
  } as const,
} as const;

export type VMRequirementKey = keyof typeof INFRASTRUCTURE_REQUIREMENTS.vms;
export type InfraRole = keyof typeof INFRASTRUCTURE_REQUIREMENTS.role_to_range;

// Helper function to get VM ID range for a role
export function getVMIdRangeForRole(role: string): { min: number; max: number } | null {
  const rangeKey = INFRASTRUCTURE_REQUIREMENTS.role_to_range[role as InfraRole];
  if (!rangeKey) return null;
  return VM_ID_RANGES[rangeKey as keyof typeof VM_ID_RANGES] || null;
}

// Helper function to validate VM ID is in correct range for role
export function isVMIdValidForRole(vmId: number, role: string): boolean {
  const range = getVMIdRangeForRole(role);
  if (!range) return true; // Unknown roles are allowed in APPLICATIONS range
  return vmId >= range.min && vmId <= range.max;
}
