import { InitOptions } from "./index";
import fs from "fs";
import path from "path";

export const createNetworkingFile = ({
  projectName,
  infrastructureTier,
  outputDir,
}: InitOptions): void => {
  // Use outputDir if provided (for services/ folder), otherwise use project root
  const targetDir = outputDir || path.resolve(process.cwd(), projectName);
  const filePath = path.join(targetDir, "networking.yaml");

  const isLocal = infrastructureTier === "local";

  // VM IDs based on tier (HA for production)
  const powerdnsVmIds = isLocal ? "[50]" : "[50, 51]";
  const dnsdistVmIds = isLocal ? "[60]" : "[60, 61]";
  const headscaleVmIds = isLocal ? "[100]" : "[100, 101]";

  const content = `# ════════════════════════════════════════════════════════════════════════════
# GLOBAL NETWORKING
# ════════════════════════════════════════════════════════════════════════════
#
# Global network services. Zone-specific → regions/{region}/zones/{zone}/networking.yaml
#
# VM ID Ranges:
#   PowerDNS:  50-59   (authoritative DNS)
#   dnsdist:   60-69   (DNS load balancer)
#   Headscale: 100-109 (VPN control plane)
#
# VM specs: see compute.yaml (type: edge-std, security-std)
# Customize: create apps/powerdns.yaml, apps/headscale.yaml
#
# ════════════════════════════════════════════════════════════════════════════

# ────────────────────────────────────────────────────────────────────────────
# DNS
# ────────────────────────────────────────────────────────────────────────────
# type: powerdns | cloudflare | hybrid
#
dns:
  type: powerdns

  powerdns:
    vm_ids: ${powerdnsVmIds}
    database: powerdns

  dnsdist:
    vm_ids: ${dnsdistVmIds}

  # cloudflare:
  #   api_token:
  #     type: env
  #     var_name: CLOUDFLARE_API_TOKEN

# ────────────────────────────────────────────────────────────────────────────
# VPN
# ────────────────────────────────────────────────────────────────────────────
vpn:
  type: headscale
  vm_ids: ${headscaleVmIds}
  database: headscale

# ────────────────────────────────────────────────────────────────────────────
# MESH NETWORKS (global)
# ────────────────────────────────────────────────────────────────────────────
mesh_networks:
  - name: management
    subnet: 10.10.0.0/16

  - name: backup
    subnet: 10.40.0.0/16
`;

  fs.writeFileSync(filePath, content);
};
