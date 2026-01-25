// ───────────────────────────────────────────────────────────────────────────
// INFRASTRUCTURE REQUIREMENTS - VM specs by tier and role
// ───────────────────────────────────────────────────────────────────────────

import { VM_ID_RANGES } from "./constants";

export const INFRASTRUCTURE_REQUIREMENTS = {
  // VM SPECIFICATIONS BY ROLE AND TIER
  vms: {
    // ═══════════════════════════════════════════════════════════════════════
    // EDGE (1-99) - Network Entry, per-zone
    // ═══════════════════════════════════════════════════════════════════════
    vyos: {
      role: "firewall" as const,
      vm_id_range: "EDGE" as const,
      ha_mechanism: "VRRP",
      deployed_on: "zone" as const,
      min_count: { local: 1, production: 2, enterprise: 2 },
      specs: {
        local:      { vcpu: 2, ram_gb: 2,  disk_gb: 20 },
        production: { vcpu: 4, ram_gb: 4,  disk_gb: 20 },
        enterprise: { vcpu: 8, ram_gb: 8,  disk_gb: 20 },
      },
    },
    dnsdist: {
      role: "dns_lb" as const,
      vm_id_range: "EDGE" as const,
      ha_mechanism: "Keepalived",
      deployed_on: "global" as const,
      min_count: { local: 0, production: 2, enterprise: 2 },
      specs: {
        local:      { vcpu: 1, ram_gb: 1,  disk_gb: 10 },
        production: { vcpu: 2, ram_gb: 4,  disk_gb: 20 },
        enterprise: { vcpu: 2, ram_gb: 4,  disk_gb: 20 },
      },
    },
    powerdns: {
      role: "dns_server" as const,
      vm_id_range: "EDGE" as const,
      ha_mechanism: "LB + shared DB",
      deployed_on: "global" as const,
      min_count: { local: 1, production: 2, enterprise: 3 },
      specs: {
        local:      { vcpu: 1, ram_gb: 2,  disk_gb: 20 },
        production: { vcpu: 2, ram_gb: 4,  disk_gb: 40 },
        enterprise: { vcpu: 2, ram_gb: 4,  disk_gb: 40 },
      },
    },

    // ═══════════════════════════════════════════════════════════════════════
    // SECURITY (100-199) - Zero-trust, global
    // ═══════════════════════════════════════════════════════════════════════
    headscale: {
      role: "bastion" as const,
      vm_id_range: "SECURITY" as const,
      ha_mechanism: "LB + shared DB",
      deployed_on: "global" as const,
      min_count: { local: 1, production: 2, enterprise: 3 },
      specs: {
        local:      { vcpu: 1, ram_gb: 2,  disk_gb: 20 },
        production: { vcpu: 2, ram_gb: 4,  disk_gb: 40 },
        enterprise: { vcpu: 4, ram_gb: 8,  disk_gb: 40 },
      },
    },
    teleport: {
      role: "ssh_bastion" as const,
      vm_id_range: "SECURITY" as const,
      ha_mechanism: "LB + shared DB",
      deployed_on: "global" as const,
      min_count: { local: 0, production: 2, enterprise: 2 },
      specs: {
        local:      { vcpu: 1, ram_gb: 2,  disk_gb: 20 },
        production: { vcpu: 2, ram_gb: 4,  disk_gb: 40 },
        enterprise: { vcpu: 2, ram_gb: 4,  disk_gb: 40 },
      },
    },
    crowdsec: {
      role: "ids" as const,
      vm_id_range: "SECURITY" as const,
      ha_mechanism: "Local API + Central API",
      deployed_on: "global" as const,
      min_count: { local: 0, production: 1, enterprise: 2 },
      specs: {
        local:      { vcpu: 1, ram_gb: 2,  disk_gb: 20 },
        production: { vcpu: 2, ram_gb: 4,  disk_gb: 40 },
        enterprise: { vcpu: 2, ram_gb: 4,  disk_gb: 40 },
      },
    },
    openbao: {
      role: "secrets" as const,
      vm_id_range: "SECURITY" as const,
      ha_mechanism: "Raft consensus",
      deployed_on: "global" as const,
      min_count: { local: 1, production: 3, enterprise: 3 },
      specs: {
        local:      { vcpu: 1, ram_gb: 2,  disk_gb: 20 },
        production: { vcpu: 2, ram_gb: 4,  disk_gb: 40 },
        enterprise: { vcpu: 2, ram_gb: 4,  disk_gb: 40 },
      },
    },

    // ═══════════════════════════════════════════════════════════════════════
    // IAM & DATA (200-299) - Identity & databases, global
    // ═══════════════════════════════════════════════════════════════════════
    keycloak: {
      role: "iam_sso" as const,
      vm_id_range: "IAM_DATA" as const,
      ha_mechanism: "Infinispan cluster",
      deployed_on: "global" as const,
      min_count: { local: 1, production: 2, enterprise: 3 },
      specs: {
        local:      { vcpu: 2, ram_gb: 4,  disk_gb: 40 },
        production: { vcpu: 4, ram_gb: 8,  disk_gb: 40 },
        enterprise: { vcpu: 4, ram_gb: 16, disk_gb: 60 },
      },
    },
    postgresql: {
      role: "database" as const,
      vm_id_range: "IAM_DATA" as const,
      ha_mechanism: "Patroni + etcd",
      deployed_on: "global" as const,
      min_count: { local: 1, production: 3, enterprise: 3 },
      specs: {
        local:      { vcpu: 2, ram_gb: 4,   disk_gb: 50 },
        production: { vcpu: 4, ram_gb: 8,   disk_gb: 150 },
        enterprise: { vcpu: 8, ram_gb: 16,  disk_gb: 300 },
      },
    },
    redis: {
      role: "cache" as const,
      vm_id_range: "IAM_DATA" as const,
      ha_mechanism: "Sentinel",
      deployed_on: "global" as const,
      min_count: { local: 0, production: 3, enterprise: 3 },
      specs: {
        local:      { vcpu: 1, ram_gb: 2,  disk_gb: 10 },
        production: { vcpu: 2, ram_gb: 8,  disk_gb: 20 },
        enterprise: { vcpu: 2, ram_gb: 16, disk_gb: 40 },
      },
    },

    // ═══════════════════════════════════════════════════════════════════════
    // OBSERVABILITY (300-399) - Monitoring & logging
    // ═══════════════════════════════════════════════════════════════════════
    prometheus: {
      role: "monitoring" as const,
      vm_id_range: "OBSERVABILITY" as const,
      ha_mechanism: "Dual scrape",
      deployed_on: "region" as const,
      min_count: { local: 0, production: 2, enterprise: 2 },
      specs: {
        local:      { vcpu: 2, ram_gb: 4,   disk_gb: 50 },
        production: { vcpu: 4, ram_gb: 16,  disk_gb: 100 },
        enterprise: { vcpu: 4, ram_gb: 32,  disk_gb: 200 },
      },
    },
    grafana: {
      role: "dashboards" as const,
      vm_id_range: "OBSERVABILITY" as const,
      ha_mechanism: "LB + shared DB",
      deployed_on: "global" as const,
      min_count: { local: 0, production: 2, enterprise: 2 },
      specs: {
        local:      { vcpu: 1, ram_gb: 2,  disk_gb: 20 },
        production: { vcpu: 2, ram_gb: 4,  disk_gb: 20 },
        enterprise: { vcpu: 2, ram_gb: 4,  disk_gb: 20 },
      },
    },
    loki: {
      role: "logging" as const,
      vm_id_range: "OBSERVABILITY" as const,
      ha_mechanism: "Memberlist",
      deployed_on: "region" as const,
      min_count: { local: 0, production: 2, enterprise: 3 },
      specs: {
        local:      { vcpu: 2, ram_gb: 4,   disk_gb: 50 },
        production: { vcpu: 4, ram_gb: 8,   disk_gb: 100 },
        enterprise: { vcpu: 4, ram_gb: 16,  disk_gb: 200 },
      },
    },
    alertmanager: {
      role: "alerting" as const,
      vm_id_range: "OBSERVABILITY" as const,
      ha_mechanism: "Gossip cluster",
      deployed_on: "region" as const,
      min_count: { local: 0, production: 2, enterprise: 3 },
      specs: {
        local:      { vcpu: 1, ram_gb: 1,  disk_gb: 10 },
        production: { vcpu: 2, ram_gb: 4,  disk_gb: 20 },
        enterprise: { vcpu: 2, ram_gb: 4,  disk_gb: 20 },
      },
    },
    uptime_kuma: {
      role: "status_page" as const,
      vm_id_range: "OBSERVABILITY" as const,
      ha_mechanism: null,
      deployed_on: "global" as const,
      min_count: { local: 0, production: 1, enterprise: 1 },
      specs: {
        local:      { vcpu: 1, ram_gb: 1,  disk_gb: 10 },
        production: { vcpu: 1, ram_gb: 2,  disk_gb: 20 },
        enterprise: { vcpu: 1, ram_gb: 2,  disk_gb: 20 },
      },
    },
    wazuh: {
      role: "siem" as const,
      vm_id_range: "OBSERVABILITY" as const,
      ha_mechanism: "Cluster mode",
      deployed_on: "region" as const,
      min_count: { local: 0, production: 1, enterprise: 2 },
      specs: {
        local:      { vcpu: 2, ram_gb: 4,  disk_gb: 50 },
        production: { vcpu: 4, ram_gb: 8,  disk_gb: 100 },
        enterprise: { vcpu: 4, ram_gb: 16, disk_gb: 200 },
      },
    },

    // ═══════════════════════════════════════════════════════════════════════
    // INFRA (400-499) - Load balancing & tools
    // ═══════════════════════════════════════════════════════════════════════
    haproxy_edge: {
      role: "load_balancer" as const,
      vm_id_range: "INFRA" as const,
      ha_mechanism: "Keepalived",
      deployed_on: "zone" as const,
      min_count: { local: 0, production: 2, enterprise: 2 },
      specs: {
        local:      { vcpu: 1, ram_gb: 2,  disk_gb: 20 },
        production: { vcpu: 2, ram_gb: 4,  disk_gb: 20 },
        enterprise: { vcpu: 4, ram_gb: 8,  disk_gb: 20 },
      },
    },
    haproxy_k8s: {
      role: "load_balancer" as const,
      vm_id_range: "INFRA" as const,
      ha_mechanism: "Keepalived",
      deployed_on: "zone" as const,
      min_count: { local: 0, production: 2, enterprise: 2 },
      specs: {
        local:      { vcpu: 1, ram_gb: 2,  disk_gb: 20 },
        production: { vcpu: 2, ram_gb: 4,  disk_gb: 20 },
        enterprise: { vcpu: 2, ram_gb: 4,  disk_gb: 20 },
      },
    },
    soverstack: {
      role: "management" as const,
      vm_id_range: "INFRA" as const,
      ha_mechanism: null,
      deployed_on: "global" as const,
      min_count: { local: 1, production: 1, enterprise: 1 },
      specs: {
        local:      { vcpu: 1, ram_gb: 2,  disk_gb: 20 },
        production: { vcpu: 2, ram_gb: 4,  disk_gb: 40 },
        enterprise: { vcpu: 2, ram_gb: 4,  disk_gb: 40 },
      },
    },
    gitea: {
      role: "git_server" as const,
      vm_id_range: "INFRA" as const,
      ha_mechanism: "LB + shared DB",
      deployed_on: "global" as const,
      min_count: { local: 0, production: 1, enterprise: 2 },
      specs: {
        local:      { vcpu: 1, ram_gb: 2,  disk_gb: 20 },
        production: { vcpu: 2, ram_gb: 4,  disk_gb: 50 },
        enterprise: { vcpu: 2, ram_gb: 4,  disk_gb: 100 },
      },
    },
    harbor: {
      role: "registry" as const,
      vm_id_range: "INFRA" as const,
      ha_mechanism: "LB + shared storage",
      deployed_on: "global" as const,
      min_count: { local: 0, production: 1, enterprise: 2 },
      specs: {
        local:      { vcpu: 2, ram_gb: 4,   disk_gb: 50 },
        production: { vcpu: 4, ram_gb: 8,   disk_gb: 200 },
        enterprise: { vcpu: 4, ram_gb: 8,   disk_gb: 500 },
      },
    },
    pentest: {
      role: "pentest" as const,
      vm_id_range: "INFRA" as const,
      ha_mechanism: null,
      deployed_on: "global" as const,
      min_count: { local: 0, production: 0, enterprise: 1 },
      specs: {
        local:      { vcpu: 2, ram_gb: 4,  disk_gb: 40 },
        production: { vcpu: 4, ram_gb: 8,  disk_gb: 80 },
        enterprise: { vcpu: 4, ram_gb: 8,  disk_gb: 80 },
      },
    },

    // ═══════════════════════════════════════════════════════════════════════
    // BACKUP (1000-1999) - Hub only
    // ═══════════════════════════════════════════════════════════════════════
    pbs: {
      role: "backup_server" as const,
      vm_id_range: "BACKUP" as const,
      ha_mechanism: null,
      deployed_on: "hub" as const,
      min_count: { local: 0, production: 1, enterprise: 2 },
      specs: {
        local:      { vcpu: 2, ram_gb: 4,   disk_gb: 100 },
        production: { vcpu: 4, ram_gb: 8,   disk_gb: 500 },
        enterprise: { vcpu: 4, ram_gb: 16,  disk_gb: 1000 },
      },
    },
    minio: {
      role: "object_storage" as const,
      vm_id_range: "BACKUP" as const,
      ha_mechanism: "Distributed mode",
      deployed_on: "hub" as const,
      min_count: { local: 0, production: 1, enterprise: 4 },
      specs: {
        local:      { vcpu: 2, ram_gb: 4,   disk_gb: 100 },
        production: { vcpu: 4, ram_gb: 8,   disk_gb: 500 },
        enterprise: { vcpu: 4, ram_gb: 16,  disk_gb: 1000 },
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

  // ROLE TO VM_ID_RANGE MAPPING (simplified by group)
  role_to_range: {
    // Edge (1-99)
    firewall: "EDGE",
    dns_lb: "EDGE",
    dns_server: "EDGE",
    // Security (100-199)
    bastion: "SECURITY",
    ssh_bastion: "SECURITY",
    ids: "SECURITY",
    secrets: "SECURITY",
    // IAM & Data (200-299)
    iam_sso: "IAM_DATA",
    database: "IAM_DATA",
    cache: "IAM_DATA",
    // Observability (300-399)
    monitoring: "OBSERVABILITY",
    alerting: "OBSERVABILITY",
    dashboards: "OBSERVABILITY",
    logging: "OBSERVABILITY",
    status_page: "OBSERVABILITY",
    siem: "OBSERVABILITY",
    // Infra (400-499)
    load_balancer: "INFRA",
    management: "INFRA",
    git_server: "INFRA",
    registry: "INFRA",
    pentest: "INFRA",
    ci_runner: "INFRA",
    // Kubernetes (500-999)
    k8s_master: "K8S_MASTER",
    k8s_worker: "K8S_WORKER",
    // Backup (1000-1999)
    backup_server: "BACKUP",
    object_storage: "BACKUP",
    // Apps (2000+)
    general_purpose: "APPLICATIONS",
  } as const,

  // DEPLOYMENT LOCATION BY SERVICE
  deployment_location: {
    global: ["headscale", "teleport", "crowdsec", "keycloak", "openbao", "dnsdist", "powerdns", "postgresql", "redis", "grafana", "uptime_kuma", "soverstack", "gitea", "harbor", "pentest"],
    region: ["prometheus", "alertmanager", "loki", "wazuh"],
    hub: ["pbs", "minio"],
    zone: ["vyos", "haproxy_edge", "haproxy_k8s"],
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
