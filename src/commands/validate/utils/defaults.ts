import { NormalizedInfrastructure } from "./normalizer";

/**
 * Applies default values to infrastructure configuration
 *
 * SECURITY & HA DEFAULTS:
 * - Firewall enabled by default
 * - Bastion OIDC enforcement (security)
 * - Minimum HA requirements (3 nodes, odd numbers)
 * - Network defaults (pod_cidr, service_cidr, CNI)
 * - Auto-scaling defaults
 *
 * This ensures secure and highly available infrastructure even if user
 * doesn't explicitly configure certain options.
 */
export function applyDefaults(infra: NormalizedInfrastructure): NormalizedInfrastructure {
  const normalized = { ...infra };

  // ============================================================
  // FIREWALL DEFAULTS
  // ============================================================
  if (normalized.firewall) {
    normalized.firewall = {
      ...normalized.firewall,
      enabled: normalized.firewall.enabled ?? true, // Enabled by default for security
      type: normalized.firewall.type ?? "vyos",
    };
  }

  // ============================================================
  // BASTION DEFAULTS
  // ============================================================
  if (normalized.bastion) {
    normalized.bastion = {
      ...normalized.bastion,
      enabled: normalized.bastion.enabled ?? true,
      type: normalized.bastion.type ?? "headscale",
      oidc_enforced: true, // ALWAYS enforced for security - cannot be disabled
      database_type: normalized.bastion.database_type ?? "postgres", // Postgres for HA
      vpn_subnet: normalized.bastion.vpn_subnet ?? "100.64.0.0/10", // CGNAT range
    };
  }

  // ============================================================
  // DATACENTER DEFAULTS
  // ============================================================
  if (normalized.datacenter) {
    // Network defaults
    normalized.datacenter.network = {
      type: normalized.datacenter.network?.type ?? "vswitch",
      failover_subnet: normalized.datacenter.network?.failover_subnet,
    };

    // Cluster network defaults
    if (normalized.datacenter.cluster) {
      normalized.datacenter.cluster = {
        private_network: normalized.datacenter.cluster.private_network ?? "10.0.10.0/24",
        public_network: normalized.datacenter.cluster.public_network ?? "10.0.11.0/24",
      };
    }

    // Ceph defaults
    if (normalized.datacenter.ceph) {
      normalized.datacenter.ceph = {
        enabled: normalized.datacenter.ceph.enabled ?? false,
        servers:
          normalized.datacenter.ceph.servers ??
          normalized.datacenter.servers.flatMap((s) => (s.name ? [s.name] : [])) ??
          [],
        private_network: normalized.datacenter.ceph.private_network ?? "10.0.1.0/24",
        public_network: normalized.datacenter.ceph.public_network ?? "10.0.2.0/24",
      };
    }
  }

  // ============================================================
  // COMPUTE DEFAULTS
  // ============================================================
  if (normalized.compute) {
    // Ensure arrays exist
    normalized.compute.instance_type_definitions =
      normalized.compute.instance_type_definitions ?? [];
    normalized.compute.virtual_machines = normalized.compute.virtual_machines ?? [];
    normalized.compute.linux_containers = normalized.compute.linux_containers ?? [];
  }

  // ============================================================
  // CLUSTER DEFAULTS
  // ============================================================
  if (normalized.cluster) {
    // Network defaults - CRITICAL for K8s
    normalized.cluster.network = {
      pod_cidr: normalized.cluster.network?.pod_cidr ?? "10.244.0.0/16",
      service_cidr: normalized.cluster.network?.service_cidr ?? "10.96.0.0/12",
      cni: normalized.cluster.network?.cni ?? "cilium", // Cilium by default for eBPF
      cilium_features:
        normalized.cluster.network?.cni === "cilium"
          ? {
              ebpf_enabled: normalized.cluster.network?.cilium_features?.ebpf_enabled ?? true,
              cluster_mesh: normalized.cluster.network?.cilium_features?.cluster_mesh ?? true, // For hybrid cloud
            }
          : undefined,
    };

    // Auto-scaling defaults
    if (normalized.cluster.auto_scaling) {
      normalized.cluster.auto_scaling = {
        enabled: normalized.cluster.auto_scaling.enabled ?? false,
        min_nodes: normalized.cluster.auto_scaling.min_nodes ?? 3, // HA minimum
        max_nodes: normalized.cluster.auto_scaling.max_nodes ?? 10,
        cpu_utilization_percentage:
          normalized.cluster.auto_scaling.cpu_utilization_percentage ?? 70,
        providers: normalized.cluster.auto_scaling.providers ?? [],
      };
    }
  }

  // ============================================================
  // FEATURES DEFAULTS
  // ============================================================
  if (normalized.features) {
    // Traefik dashboard defaults
    if (normalized.features.traefik_dashboard) {
      normalized.features.traefik_dashboard = {
        enabled: normalized.features.traefik_dashboard.enabled ?? false,
        sub_domains: normalized.features.traefik_dashboard.sub_domains ?? "traefik",
        accessible_outside_vpn:
          normalized.features.traefik_dashboard.accessible_outside_vpn ?? false, // Secure by default
      };
    }

    // SSO defaults
    if (normalized.features.sso) {
      normalized.features.sso = {
        enabled: normalized.features.sso.enabled ?? false,
        type: normalized.features.sso.type ?? "authentik",
        sub_domains: normalized.features.sso.sub_domains ?? "sso",
        accessible_outside_vpn: normalized.features.sso.accessible_outside_vpn ?? false,
      };
    }

    // Apply same pattern for all features: secure by default (not accessible outside VPN)
    const featureDefaults = {
      accessible_outside_vpn: false, // SECURITY: VPN-only by default
    };

    // Apply to all optional features
    if (normalized.features.vault) {
      normalized.features.vault = { ...featureDefaults, ...normalized.features.vault };
    }
    if (normalized.features.monitoring) {
      normalized.features.monitoring = {
        ...featureDefaults,
        ...normalized.features.monitoring,
      };
    }
    if (normalized.features.argocd) {
      normalized.features.argocd = { ...featureDefaults, ...normalized.features.argocd };
    }
    if (normalized.features.gitlab) {
      normalized.features.gitlab = { ...featureDefaults, ...normalized.features.gitlab };
    }
    if (normalized.features.pg_admin) {
      normalized.features.pg_admin = {
        ...featureDefaults,
        ...normalized.features.pg_admin,
      };
    }
    if (normalized.features.nextcloud) {
      normalized.features.nextcloud = {
        ...featureDefaults,
        ...normalized.features.nextcloud,
      };
    }
    if (normalized.features.wiki) {
      normalized.features.wiki = { ...featureDefaults, ...normalized.features.wiki };
    }
    if (normalized.features.sonarqube) {
      normalized.features.sonarqube = {
        ...featureDefaults,
        ...normalized.features.sonarqube,
      };
    }
    if (normalized.features.nexus) {
      normalized.features.nexus = { ...featureDefaults, ...normalized.features.nexus };
    }
    if (normalized.features.velero) {
      normalized.features.velero = { ...featureDefaults, ...normalized.features.velero };
    }
    if (normalized.features.postgres_operator) {
      normalized.features.postgres_operator = {
        ...featureDefaults,
        ...normalized.features.postgres_operator,
      };
    }
    if (normalized.features.mail) {
      normalized.features.mail = { ...featureDefaults, ...normalized.features.mail };
    }
  }

  // ============================================================
  // STATE DEFAULTS
  // ============================================================
  if (!normalized.state) {
    normalized.state = {
      backend: "local",
      path: normalized.project?.environment
        ? `.soverstack/${normalized.project.environment}/state`
        : ".soverstack/state",
    };
  }

  return normalized;
}

/**
 * Get default values documentation for user reference
 */
export function getDefaultsDocumentation(): Record<string, any> {
  return {
    firewall: {
      enabled: true,
      type: "vyos",
      min_vms: 2,
    },
    bastion: {
      enabled: true,
      type: "headscale",
      oidc_enforced: true,
      database_type: "postgres",
      vpn_subnet: "100.64.0.0/10",
      min_vms: 2,
    },
    datacenter: {
      network: {
        type: "vswitch",
      },
      ceph: {
        enabled: false,
      },
    },
    cluster: {
      network: {
        pod_cidr: "10.244.0.0/16",
        service_cidr: "10.96.0.0/12",
        cni: "cilium",
        cilium_features: {
          ebpf_enabled: true,
          cluster_mesh: true,
        },
      },
      auto_scaling: {
        enabled: false,
        min_nodes: 3,
        max_nodes: 10,
        cpu_utilization_percentage: 70,
      },
    },
    features: {
      accessible_outside_vpn: false, // All features VPN-only by default
    },
    state: {
      backend: "local",
      path: ".soverstack/state",
    },
  };
}
