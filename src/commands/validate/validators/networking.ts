import {
  InfrastructureTierType,
  NetworkingConfig,
} from "../../../types";
import { HA_REQUIREMENTS } from "../../../constants";
import { ValidationResult, ValidationContext, addError, addWarning } from "../utils/types";
import { validateCidrFormat } from "../rules/security";

/**
 * Validates networking configuration (public IP, DNS, VPN, Firewall)
 */
export function validateNetworking(
  networking: NetworkingConfig,
  context: ValidationContext,
  result: ValidationResult,
  infrastructureTier: InfrastructureTierType
): void {
  const layer = "networking";
  const haReqs = HA_REQUIREMENTS[infrastructureTier];

  // Validate public IP configuration
  if (networking.public_ip) {
    validatePublicIPConfig(networking.public_ip, result, layer, infrastructureTier);
  } else if (infrastructureTier !== "local") {
    addWarning(
      result,
      layer,
      "public_ip",
      "Public IP configuration is recommended for production",
      "Configure public_ip with your allocated IP block"
    );
  }

  // Validate DNS configuration
  if (networking.dns) {
    validateDNSConfig(networking.dns, result, layer, infrastructureTier);
  }

  // Validate VPN configuration
  if (networking.vpn) {
    validateVPNConfig(networking.vpn, context, result, layer, infrastructureTier, haReqs);
  } else if (infrastructureTier !== "local") {
    addError(
      result,
      layer,
      "vpn",
      `VPN configuration is required for ${infrastructureTier} tier`,
      "critical",
      "Add VPN configuration with Headscale for secure access"
    );
  }

  // Validate Firewall configuration
  if (networking.firewall) {
    validateFirewallConfig(networking.firewall, context, result, layer, infrastructureTier, haReqs);
  } else if (infrastructureTier !== "local") {
    addError(
      result,
      layer,
      "firewall",
      `Firewall configuration is required for ${infrastructureTier} tier`,
      "critical",
      "Add firewall configuration with VyOS for network security"
    );
  }
}

/**
 * Validates public IP configuration
 */
function validatePublicIPConfig(
  publicIP: NetworkingConfig["public_ip"],
  result: ValidationResult,
  layer: string,
  infrastructureTier: InfrastructureTierType
): void {
  if (!publicIP) return;

  if (!["allocated_block", "bgp"].includes(publicIP.type)) {
    addError(
      result,
      layer,
      "public_ip.type",
      `Invalid public IP type: ${publicIP.type}`,
      "error",
      'Must be one of: "allocated_block", "bgp"'
    );
  }

  if (publicIP.type === "allocated_block") {
    if (!publicIP.allocated_block?.block) {
      addError(
        result,
        layer,
        "public_ip.allocated_block.block",
        "IP block is required for allocated_block type",
        "error",
        'Set block to your CIDR (e.g., "203.0.113.0/27")'
      );
    } else {
      validateCidrFormat(publicIP.allocated_block.block, "public_ip.allocated_block.block", result, layer);
    }

    if (!publicIP.allocated_block?.gateway) {
      addWarning(
        result,
        layer,
        "public_ip.allocated_block.gateway",
        "Gateway not configured",
        "Set gateway to your datacenter gateway IP"
      );
    }
  }

  // Validate VRRP failover configuration
  if (publicIP.failover) {
    if (publicIP.failover.type !== "vrrp") {
      addError(
        result,
        layer,
        "public_ip.failover.type",
        `Invalid failover type: ${publicIP.failover.type}`,
        "error",
        'Currently only "vrrp" is supported'
      );
    }

    if (!publicIP.failover.routers || publicIP.failover.routers.length === 0) {
      addError(
        result,
        layer,
        "public_ip.failover.routers",
        "VRRP failover requires at least one router",
        "error",
        "Add router configuration with name, vm_id, and priority"
      );
    } else {
      const priorities = new Set<number>();
      publicIP.failover.routers.forEach((router, index) => {
        const routerField = `public_ip.failover.routers[${index}]`;

        if (!router.name) {
          addError(result, layer, `${routerField}.name`, "Router name is required", "error");
        }

        if (!router.vm_id) {
          addError(result, layer, `${routerField}.vm_id`, "Router VM ID is required", "error");
        }

        if (router.priority === undefined) {
          addError(result, layer, `${routerField}.priority`, "Router priority is required", "error");
        } else if (priorities.has(router.priority)) {
          addWarning(
            result,
            layer,
            `${routerField}.priority`,
            `Duplicate priority: ${router.priority}`,
            "Each router should have a unique priority for proper failover"
          );
        } else {
          priorities.add(router.priority);
        }
      });
    }
  } else if (infrastructureTier !== "local") {
    addWarning(
      result,
      layer,
      "public_ip.failover",
      "VRRP failover not configured",
      "Configure failover for high availability of public IPs"
    );
  }
}

/**
 * Validates DNS configuration
 */
function validateDNSConfig(
  dns: NetworkingConfig["dns"],
  result: ValidationResult,
  layer: string,
  infrastructureTier: InfrastructureTierType
): void {
  if (!dns) return;

  if (!["powerdns", "cloudflare", "hybrid"].includes(dns.type)) {
    addError(
      result,
      layer,
      "dns.type",
      `Invalid DNS type: ${dns.type}`,
      "error",
      'Must be one of: "powerdns", "cloudflare", "hybrid"'
    );
  }

  // Validate PowerDNS configuration
  if ((dns.type === "powerdns" || dns.type === "hybrid") && dns.powerdns) {
    if (!dns.powerdns.vm_ids || dns.powerdns.vm_ids.length === 0) {
      addWarning(
        result,
        layer,
        "dns.powerdns.vm_ids",
        "PowerDNS VMs not configured",
        "Add VM IDs for PowerDNS servers"
      );
    } else if (infrastructureTier !== "local" && dns.powerdns.vm_ids.length < 3) {
      addWarning(
        result,
        layer,
        "dns.powerdns.vm_ids",
        `PowerDNS has ${dns.powerdns.vm_ids.length} servers - 3 recommended for HA`,
        "Add more PowerDNS servers for high availability"
      );
    }

    if (!dns.powerdns.database) {
      addWarning(
        result,
        layer,
        "dns.powerdns.database",
        "PowerDNS database reference not set",
        "Set database to reference your PostgreSQL cluster"
      );
    }
  }

  // Validate Cloudflare configuration
  if ((dns.type === "cloudflare" || dns.type === "hybrid") && dns.cloudflare) {
    if (!dns.cloudflare.credentials) {
      addError(
        result,
        layer,
        "dns.cloudflare.credentials",
        "Cloudflare credentials are required",
        "critical",
        "Configure credentials using CredentialRef"
      );
    }
  }

  // Validate zones
  if (!dns.zones || dns.zones.length === 0) {
    addWarning(
      result,
      layer,
      "dns.zones",
      "No DNS zones configured",
      "Add at least one DNS zone for your domain"
    );
  } else {
    dns.zones.forEach((zone, index) => {
      const zoneField = `dns.zones[${index}]`;

      if (!zone.domain) {
        addError(result, layer, `${zoneField}.domain`, "Zone domain is required", "error");
      }

      if (!["primary", "secondary"].includes(zone.type)) {
        addError(
          result,
          layer,
          `${zoneField}.type`,
          `Invalid zone type: ${zone.type}`,
          "error",
          'Must be one of: "primary", "secondary"'
        );
      }
    });
  }
}

/**
 * Validates VPN configuration
 */
function validateVPNConfig(
  vpn: NetworkingConfig["vpn"],
  context: ValidationContext,
  result: ValidationResult,
  layer: string,
  infrastructureTier: InfrastructureTierType,
  haReqs: typeof HA_REQUIREMENTS[keyof typeof HA_REQUIREMENTS]
): void {
  if (!vpn) return;

  if (!vpn.enabled) {
    if (infrastructureTier !== "local") {
      addError(
        result,
        layer,
        "vpn.enabled",
        `VPN must be enabled for ${infrastructureTier} tier`,
        "critical",
        "Set enabled: true for secure access"
      );
    }
    return;
  }

  if (!["headscale", "wireguard", "netbird"].includes(vpn.type)) {
    addError(
      result,
      layer,
      "vpn.type",
      `Invalid VPN type: ${vpn.type}`,
      "error",
      'Must be one of: "headscale", "wireguard", "netbird"'
    );
  }

  // Validate VM IDs
  if (!vpn.vm_ids || vpn.vm_ids.length === 0) {
    addError(
      result,
      layer,
      "vpn.vm_ids",
      "VPN VM IDs are required",
      "error",
      "Add at least one VM ID for VPN"
    );
  } else {
    // Check HA requirement
    if (vpn.vm_ids.length < haReqs.min_vpn_vms) {
      if (infrastructureTier === "local") {
        addWarning(
          result,
          layer,
          "vpn.vm_ids",
          `VPN has ${vpn.vm_ids.length} VM(s) - not highly available (OK for local)`,
          `For production, use at least ${haReqs.min_vpn_vms} VMs for HA`
        );
      } else {
        addError(
          result,
          layer,
          "vpn.vm_ids",
          `VPN requires at least ${haReqs.min_vpn_vms} VMs for HA in ${infrastructureTier} tier`,
          "error",
          `Add ${haReqs.min_vpn_vms - vpn.vm_ids.length} more VM(s)`
        );
      }
    }

    // Validate VM ID ranges (100-199 for Bastion)
    vpn.vm_ids.forEach((vmId, index) => {
      if (vmId < 100 || vmId > 199) {
        addError(
          result,
          layer,
          `vpn.vm_ids[${index}]`,
          `VPN VM ID ${vmId} must be in range 100-199`,
          "error"
        );
      }
    });
  }

  // Validate public IP for VPN
  if (vpn.public_ip) {
    if (!vpn.public_ip.ip) {
      addWarning(
        result,
        layer,
        "vpn.public_ip.ip",
        "VPN public IP not set",
        "Set a public IP from your allocated block"
      );
    }

    if (vpn.public_ip.vrrp_id !== undefined) {
      if (vpn.public_ip.vrrp_id < 1 || vpn.public_ip.vrrp_id > 255) {
        addError(
          result,
          layer,
          "vpn.public_ip.vrrp_id",
          `VRRP ID ${vpn.public_ip.vrrp_id} must be between 1 and 255`,
          "error"
        );
      }
    }
  }

  // Validate VPN subnet
  if (vpn.vpn_subnet) {
    validateCidrFormat(vpn.vpn_subnet, "vpn.vpn_subnet", result, layer);
  }
}

/**
 * Validates Firewall configuration
 */
function validateFirewallConfig(
  firewall: NetworkingConfig["firewall"],
  context: ValidationContext,
  result: ValidationResult,
  layer: string,
  infrastructureTier: InfrastructureTierType,
  haReqs: typeof HA_REQUIREMENTS[keyof typeof HA_REQUIREMENTS]
): void {
  if (!firewall) return;

  if (!firewall.enabled) {
    if (infrastructureTier !== "local") {
      addError(
        result,
        layer,
        "firewall.enabled",
        `Firewall must be enabled for ${infrastructureTier} tier`,
        "critical",
        "Set enabled: true for network security"
      );
    }
    return;
  }

  if (!["vyos", "opnsense", "pfsense"].includes(firewall.type)) {
    addError(
      result,
      layer,
      "firewall.type",
      `Invalid firewall type: ${firewall.type}`,
      "error",
      'Must be one of: "vyos", "opnsense", "pfsense"'
    );
  }

  // Validate VM IDs
  if (!firewall.vm_ids || firewall.vm_ids.length === 0) {
    addError(
      result,
      layer,
      "firewall.vm_ids",
      "Firewall VM IDs are required",
      "error",
      "Add at least one VM ID for firewall"
    );
  } else {
    // Check HA requirement
    if (firewall.vm_ids.length < haReqs.min_firewall_vms) {
      if (infrastructureTier === "local") {
        addWarning(
          result,
          layer,
          "firewall.vm_ids",
          `Firewall has ${firewall.vm_ids.length} VM(s) - not highly available (OK for local)`,
          `For production, use at least ${haReqs.min_firewall_vms} VMs for HA`
        );
      } else {
        addError(
          result,
          layer,
          "firewall.vm_ids",
          `Firewall requires at least ${haReqs.min_firewall_vms} VMs for HA in ${infrastructureTier} tier`,
          "error",
          `Add ${haReqs.min_firewall_vms - firewall.vm_ids.length} more VM(s)`
        );
      }
    }

    // Validate VM ID ranges (1-99 for Firewall)
    firewall.vm_ids.forEach((vmId, index) => {
      if (vmId < 1 || vmId > 99) {
        addError(
          result,
          layer,
          `firewall.vm_ids[${index}]`,
          `Firewall VM ID ${vmId} must be in range 1-99`,
          "error"
        );
      }
    });
  }

  // Validate public IP for firewall
  if (firewall.public_ip) {
    if (!firewall.public_ip.ip) {
      addWarning(
        result,
        layer,
        "firewall.public_ip.ip",
        "Firewall public IP not set",
        "Set a public IP from your allocated block"
      );
    }

    if (firewall.public_ip.vrrp_id !== undefined) {
      if (firewall.public_ip.vrrp_id < 1 || firewall.public_ip.vrrp_id > 255) {
        addError(
          result,
          layer,
          "firewall.public_ip.vrrp_id",
          `VRRP ID ${firewall.public_ip.vrrp_id} must be between 1 and 255`,
          "error"
        );
      }
    }
  }
}
