/**
 * Generate platform.yaml - Global configuration
 */

import fs from "fs";
import path from "path";
import { GeneratorContext, DEFAULT_FLAVORS } from "../../types";

/**
 * Default cloud images
 */
const DEFAULT_IMAGES = [
  {
    name: "debian-12",
    url: "https://cloud.debian.org/images/cloud/bookworm/latest/debian-12-generic-amd64.qcow2",
    default: true,
  },
  {
    name: "ubuntu-24",
    url: "https://cloud-images.ubuntu.com/noble/current/noble-server-cloudimg-amd64.img",
    default: false,
  },
  {
    name: "rocky-9",
    url: "https://download.rockylinux.org/pub/rocky/9/images/x86_64/Rocky-9-GenericCloud.latest.x86_64.qcow2",
    default: false,
  },
];

export function generatePlatformYaml(ctx: GeneratorContext): void {
  const { projectPath, options } = ctx;
  const filePath = path.join(projectPath, "platform.yaml");

  const content = `# ==============================================================================
# PLATFORM CONFIGURATION
# ==============================================================================
#
# Global configuration for your sovereign infrastructure.
#
# Structure:
#   inventory/   -> Physical infrastructure (servers, network)
#   workloads/   -> Logical services (VMs to deploy)
#
# ==============================================================================

project_name: ${options.projectName}
version: "1.0"
domain: ${options.domain}

# ------------------------------------------------------------------------------
# IMAGES
# ------------------------------------------------------------------------------
# Cloud images to download on Proxmox nodes.
# Referenced in workloads by name.

images:
${DEFAULT_IMAGES.map(
  (img) => `  - name: ${img.name}
    url: ${img.url}${img.default ? "\n    default: true" : ""}`
).join("\n\n")}

# ------------------------------------------------------------------------------
# DEFAULTS
# ------------------------------------------------------------------------------
# Where global services are deployed (Vault, Keycloak, PostgreSQL, etc.)

defaults:
  global_placement:
    region: ${options.primaryRegion}
    datacenter: zone-${options.primaryZone}

# ------------------------------------------------------------------------------
# FLAVORS (VM Sizes)
# ------------------------------------------------------------------------------
# Centralized instance type definitions.
# Reference in workloads: flavor: standard

flavors:
${DEFAULT_FLAVORS.map(
  (f) => `  - name: ${f.name}
    cpu: ${f.cpu}
    ram: ${f.ram}
    disk: ${f.disk}`
).join("\n\n")}

# ------------------------------------------------------------------------------
# STATE BACKEND
# ------------------------------------------------------------------------------

state:
  backend: local
  path: ./.soverstack/state

# ------------------------------------------------------------------------------
# INFRASTRUCTURE TIER
# ------------------------------------------------------------------------------
# local      -> Single node, HA optional
# production -> 3+ servers, HA enforced
# enterprise -> 5+ servers, HA + Backup enforced

infrastructure_tier: ${options.infrastructureTier}
compliance_level: ${options.complianceLevel}
`;

  fs.writeFileSync(filePath, content.trim() + "\n");
}
