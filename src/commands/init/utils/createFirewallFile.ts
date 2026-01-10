import { InitOptions } from "../utils";
import fs from "fs";
import path from "path";

export const createFirewallFile = ({ projectName }: InitOptions, env?: string) => {
  const fileName = env ? `firewall-${env}.yaml` : "firewall.yaml";
  const projectPath = path.resolve(process.cwd(), projectName);
  const filePath = path.join(projectPath, "layers/firewalls", fileName);

  const content = `# ############################################################
# 🛡️ FIREWALL & ROUTING CONFIGURATION ${env ? `- ${env.toUpperCase()}` : ""}
# ############################################################
# Documentation: https://docs.soverstack.io/configuration/firewall
#
# STRATEGY: High Availability via VRRP (Virtual Router Redundancy Protocol)
# ############################################################

enabled: true  # Enable or disable the firewall
type: "vyos"  # ONLY vyos supported for now, COMING SOON: "OPNsense" | "pfSense"
public_ip: "<PUBLIC_IP>"  # Public IP address of the firewall, most likely on the failover subnet
domain: "firewall.your-company.com"

# VM Configuration
vm_configuration:
  vm_ids: [100, 101]             # Dedicated IDs for Headscale Master & Replica 
  os_template: "debian-12"   # Recommended for Headscale stability

 
`;
  fs.writeFileSync(filePath, content);
};
