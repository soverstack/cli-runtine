import { InitOptions } from "../utils";
import fs from "fs";
import path from "path";

export const createBastionFile = ({ projectName }: InitOptions, env?: string) => {
  const fileName = env ? `bastion-${env}.yaml` : "bastion.yaml";
  const projectPath = path.resolve(process.cwd(), projectName);
  const filePath = path.join(projectPath, "layers/bastions", fileName);

  const content = `# ############################################################
# 🏰 BASTION / HEADSCALE CONFIGURATION ${env ? `- ${env.toUpperCase()}` : ""}
# ############################################################
# Documentation: https://docs.soverstack.io/configuration/bastion
# 
# NOTE: This configuration manages the Headscale Control Plane.
# Data plane traffic is routed via VyOS Subnet Routers.
# ############################################################

# Toggle Bastion/VPN infrastructure deployment
enabled: true

# Control Plane Technology
# Current: headscale (Self-hosted Tailscale control server)
# Roadmap: wireguard (Standard), netbird (P2P Mesh)
type: "headscale"

# Access Configuration
# This should be your CARP/VRRP Virtual IP (VIP) from your /29 subnet
public_ip: "${process.env.BASTION_PUBLIC_IP || "<PUBLIC_IP>"}"
domain: "vpn.your-company.com"

# High Availability (HA) VM Cluster
# Distributed across Proxmox nodes for 99.9% uptime
vm_configuration:
  vm_ids: [200, 201]             # Dedicated IDs for Headscale Master & Replica 
  os_template: "debian-12"   # Recommended for Headscale stability , see available os templates https://docs.soverstack.io/configuration/bastion#os-templates
`;
  fs.writeFileSync(filePath, content);
};
