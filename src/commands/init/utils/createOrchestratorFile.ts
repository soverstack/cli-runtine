import { InitOptions } from "./index";
import fs from "fs";
import path from "path";

export const createOrchestratorFile = ({
  projectName,
  domain,
  infrastructureTier,
  outputDir,
  datacenters,
}: InitOptions): void => {
  const targetDir = outputDir || path.resolve(process.cwd(), projectName);
  const filePath = path.join(targetDir, "orchestrator.yaml");

  const finalDomain = domain || "example.com";
  const isLocal = infrastructureTier === "local";
  const isMultiDc = datacenters && datacenters.length >= 2;
  const primaryDc = datacenters?.[0] || "main";

  const content = `# ════════════════════════════════════════════════════════════════════════════
# ORCHESTRATOR CONFIGURATION
# ════════════════════════════════════════════════════════════════════════════
#
# The orchestrator is the brain of your infrastructure.
# It runs on the PRIMARY datacenter only and manages all other datacenters.
#
# Components:
#   - Controller VM: Runs Terraform & Ansible
#   - Admin UI: Infrastructure management (VPN only)
#   - Client UI: End-user portal (public)
#   - Datacenter Manager: Multi-DC Proxmox federation (if multi-DC)
#
# ════════════════════════════════════════════════════════════════════════════

# ────────────────────────────────────────────────────────────────────────────
# CONTROLLER VM
# ────────────────────────────────────────────────────────────────────────────
# Central VM that runs Soverstack CLI, Terraform & Ansible
# This VM orchestrates all infrastructure deployments across all datacenters

controller:
  vm_id: 450                    # VM ID in TOOLS range (450-469)
  node: pve-${primaryDc}-01     # Deploy on primary datacenter
  resources:
    cores: ${isLocal ? 2 : 4}
    memory: ${isLocal ? 4096 : 8192}
    disk: ${isLocal ? 50 : 100}

# ────────────────────────────────────────────────────────────────────────────
# ADMIN UI
# ────────────────────────────────────────────────────────────────────────────
# Internal management interface for infrastructure administrators
# ⚠️  Should only be accessible via VPN for security

admin_ui:
  enabled: true
  subdomain: admin              # admin.${finalDomain}

  # Access control
  access:
    vpn_only: true              # Restrict to VPN network
    allowed_networks:           # Additional allowed networks
      - "10.0.0.0/8"

  # Features available in admin UI
  features:
    manage_servers: true        # Add/remove Proxmox nodes
    manage_clusters: true       # Cluster configuration
    view_all_tenants: true      # See all client resources
    system_logs: true           # View system logs
    global_settings: true       # Modify global config
    pricing_config: true        # Set pricing tiers
    billing_admin: true         # Manage invoices

# ────────────────────────────────────────────────────────────────────────────
# CLIENT UI
# ────────────────────────────────────────────────────────────────────────────
# Public portal where end-users manage their resources and billing

client_ui:
  enabled: true
  subdomain: console            # console.${finalDomain}

  # Public access
  access:
    public: true

  # Features available to clients
  features:
    manage_own_resources: true  # Create/delete their VMs
    view_billing: true          # View invoices & usage
    api_keys: true              # Manage API credentials
    support_tickets: true       # Open support requests
    usage_metrics: true         # Resource usage dashboards

# ────────────────────────────────────────────────────────────────────────────
# DATACENTER MANAGER (Multi-DC only)
# ────────────────────────────────────────────────────────────────────────────
# Proxmox Datacenter Manager for federating multiple Proxmox clusters
# Only deployed on the PRIMARY datacenter
${isMultiDc ? "" : "# Uncomment when you add more datacenters"}

datacenter_manager:
  enabled: ${isMultiDc}
  vm_id: 451                    # VM ID in TOOLS range (450-469)
  node: pve-${primaryDc}-01     # Primary datacenter only

  # Managed datacenters
  datacenters:
${isMultiDc && datacenters ? datacenters.map((dc, i) => `    - name: ${dc}\n      primary: ${i === 0}`).join("\n") : `    - name: ${primaryDc}\n      primary: true`}
    # - name: frankfurt
    #   primary: false

# ────────────────────────────────────────────────────────────────────────────
# BOOTSTRAP / INITIAL SETUP
# ────────────────────────────────────────────────────────────────────────────
# First-time setup configuration

bootstrap:
  # Initial admin account
  admin_user:
    email: "admin@${finalDomain}"
    # Password will be prompted on first run or set via env var
    password:
      type: env
      var_name: "SOVERSTACK_ADMIN_PASSWORD"

  # Auto-create first tenant (optional)
  # create_demo_tenant: false
`;

  fs.writeFileSync(filePath, content);
};
