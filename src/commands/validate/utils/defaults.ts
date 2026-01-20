import { NormalizedInfrastructure } from "./normalizer";
import { InfrastructureTierType } from "../../../types";
import { HA_REQUIREMENTS } from "../../../constants";

/**
 * Applies default values to infrastructure configuration
 *
 * DEFAULTS BY TIER:
 * - local: Relaxed defaults, single instances OK
 * - production/enterprise: Strict HA defaults
 *
 * SECURITY DEFAULTS (all tiers):
 * - Firewall enabled by default
 * - VPN OIDC always enforced
 * - Services not accessible outside VPN by default
 */
export function applyDefaults(infra: NormalizedInfrastructure): NormalizedInfrastructure {
  const normalized = { ...infra };
  const tier = normalized.project?.infrastructure_tier || "production";
  const haReqs = HA_REQUIREMENTS[tier];

  // ============================================================
  // PROJECT DEFAULTS
  // ============================================================
  if (!normalized.project) {
    normalized.project = {
      name: "soverstack-project",
      domain: "example.com",
      infrastructure_tier: "production",
      version: "1.0.0",
    };
  }

  // ============================================================
  // NETWORKING DEFAULTS
  // ============================================================
  if (normalized.networking) {
    // Public IP defaults
    if (normalized.networking.public_ip) {
      normalized.networking.public_ip = {
        ...normalized.networking.public_ip,
        type: normalized.networking.public_ip.type ?? "allocated_block",
      };
    }

    // DNS defaults
    if (normalized.networking.dns) {
      normalized.networking.dns = {
        ...normalized.networking.dns,
        type: normalized.networking.dns.type ?? "powerdns",
        deployment: normalized.networking.dns.deployment ?? "vm",
        zones: normalized.networking.dns.zones ?? [],
      };
    }

    // VPN defaults
    if (normalized.networking.vpn) {
      normalized.networking.vpn = {
        ...normalized.networking.vpn,
        enabled: normalized.networking.vpn.enabled ?? true,
        type: normalized.networking.vpn.type ?? "headscale",
        deployment: "vm",
        vm_ids: normalized.networking.vpn.vm_ids ?? [],
        vpn_subnet: normalized.networking.vpn.vpn_subnet ?? "100.64.0.0/10",
        oidc_enforced: true, // ALWAYS enforced - cannot be disabled
      };
    }

    // Firewall defaults
    if (normalized.networking.firewall) {
      normalized.networking.firewall = {
        ...normalized.networking.firewall,
        enabled: normalized.networking.firewall.enabled ?? true,
        type: normalized.networking.firewall.type ?? "vyos",
        deployment: "vm",
        vm_ids: normalized.networking.firewall.vm_ids ?? [],
      };
    }
  }

  // ============================================================
  // SECURITY DEFAULTS
  // ============================================================
  if (normalized.security) {
    // Vault defaults
    if (normalized.security.vault) {
      normalized.security.vault = {
        ...normalized.security.vault,
        enabled: normalized.security.vault.enabled ?? true,
        deployment: normalized.security.vault.deployment ?? (tier === "local" ? "vm" : "cluster"),
        storage: normalized.security.vault.storage ?? "postgresql",
        accessible_outside_vpn: normalized.security.vault.accessible_outside_vpn ?? false,
      };
    }

    // SSO defaults
    if (normalized.security.sso) {
      normalized.security.sso = {
        ...normalized.security.sso,
        enabled: normalized.security.sso.enabled ?? true,
        type: normalized.security.sso.type ?? "keycloak",
        deployment: normalized.security.sso.deployment ?? (tier === "local" ? "vm" : "cluster"),
        accessible_outside_vpn: normalized.security.sso.accessible_outside_vpn ?? false,
      };
    }

    // Cert Manager defaults
    if (normalized.security.cert_manager) {
      normalized.security.cert_manager = {
        ...normalized.security.cert_manager,
        enabled: normalized.security.cert_manager.enabled ?? true,
        production: normalized.security.cert_manager.production ?? (tier !== "local"),
      };
    }
  }

  // ============================================================
  // COMPUTE DEFAULTS
  // ============================================================
  if (normalized.compute) {
    normalized.compute = {
      instance_type_definitions: normalized.compute.instance_type_definitions ?? [],
      virtual_machines: normalized.compute.virtual_machines ?? [],
      linux_containers: normalized.compute.linux_containers ?? [],
    };
  }

  // ============================================================
  // K8S CLUSTER DEFAULTS
  // ============================================================
  if (normalized.k8s) {
    // Network defaults
    normalized.k8s.network = {
      pod_cidr: normalized.k8s.network?.pod_cidr ?? "10.244.0.0/16",
      service_cidr: normalized.k8s.network?.service_cidr ?? "10.96.0.0/12",
      cni: normalized.k8s.network?.cni ?? "cilium",
      cilium_features:
        (normalized.k8s.network?.cni ?? "cilium") === "cilium"
          ? {
              ebpf_enabled: normalized.k8s.network?.cilium_features?.ebpf_enabled ?? true,
              cluster_mesh: normalized.k8s.network?.cilium_features?.cluster_mesh ?? false,
            }
          : undefined,
    };

    // Ingress defaults
    if (normalized.k8s.ingress) {
      normalized.k8s.ingress = {
        ...normalized.k8s.ingress,
        type: normalized.k8s.ingress.type ?? "traefik",
        replicas: normalized.k8s.ingress.replicas ?? (tier === "local" ? 1 : 2),
        dashboard: normalized.k8s.ingress.dashboard ?? true,
        dashboard_subdomain: normalized.k8s.ingress.dashboard_subdomain ?? "traefik",
      };
    }

    // MetalLB defaults
    if (normalized.k8s.metallb) {
      normalized.k8s.metallb = {
        ...normalized.k8s.metallb,
        enabled: normalized.k8s.metallb.enabled ?? true,
        mode: "layer2",
      };
    }

    // Public IP defaults
    if (normalized.k8s.public_ip) {
      normalized.k8s.public_ip = {
        ...normalized.k8s.public_ip,
        health_check: normalized.k8s.public_ip.health_check ?? {
          type: "tcp",
          port: 443,
        },
      };
    }

    // Auto-scaling defaults
    if (normalized.k8s.auto_scaling) {
      normalized.k8s.auto_scaling = {
        enabled: normalized.k8s.auto_scaling.enabled ?? false,
        min_nodes: normalized.k8s.auto_scaling.min_nodes ?? haReqs.min_k8s_workers,
        max_nodes: normalized.k8s.auto_scaling.max_nodes ?? 10,
        cpu_utilization_percentage: normalized.k8s.auto_scaling.cpu_utilization_percentage ?? 70,
        providers: normalized.k8s.auto_scaling.providers ?? [],
      };
    }

    // Ensure node arrays exist
    normalized.k8s.master_nodes = normalized.k8s.master_nodes ?? [];
    normalized.k8s.worker_nodes = normalized.k8s.worker_nodes ?? [];
    normalized.k8s.ha_proxy_nodes = normalized.k8s.ha_proxy_nodes ?? [];
  }

  // ============================================================
  // STATE DEFAULTS
  // ============================================================
  if (!normalized.state) {
    normalized.state = {
      backend: "local",
      path: ".soverstack/state",
    };
  }

  return normalized;
}

/**
 * Get HA requirements for a specific tier
 */
export function getHARequirements(tier: InfrastructureTierType) {
  return HA_REQUIREMENTS[tier];
}

/**
 * Get default values documentation for user reference
 */
export function getDefaultsDocumentation(): Record<string, any> {
  return {
    networking: {
      public_ip: { type: "allocated_block" },
      vpn: {
        enabled: true,
        type: "headscale",
        vpn_subnet: "100.64.0.0/10",
        oidc_enforced: true,
      },
      firewall: {
        enabled: true,
        type: "vyos",
      },
      dns: { type: "powerdns" },
    },
    security: {
      vault: {
        enabled: true,
        storage: "postgresql",
        accessible_outside_vpn: false,
      },
      sso: {
        enabled: true,
        type: "keycloak",
        accessible_outside_vpn: false,
      },
    },
    k8s: {
      network: {
        pod_cidr: "10.244.0.0/16",
        service_cidr: "10.96.0.0/12",
        cni: "cilium",
      },
      ingress: {
        type: "traefik",
        replicas: 2,
        dashboard: true,
      },
      metallb: {
        enabled: true,
        mode: "layer2",
      },
    },
    state: {
      backend: "local",
      path: ".soverstack/state",
    },
    ha_requirements: HA_REQUIREMENTS,
  };
}
