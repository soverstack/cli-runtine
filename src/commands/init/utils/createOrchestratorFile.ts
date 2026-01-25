import { InitOptions } from "./index";
import fs from "fs";
import path from "path";

export const createOrchestratorFile = (options: InitOptions): void => {
  const { projectName, outputDir, regions } = options;

  // Use outputDir if provided (for services/ folder), otherwise use project root
  const targetDir = outputDir || path.resolve(process.cwd(), projectName);
  const filePath = path.join(targetDir, "orchestrator.yaml");

  // Get all zones from all regions
  const allZones: string[] = [];
  (regions || [{ name: "eu", zones: ["main"] }]).forEach((r) => {
    r.zones.forEach((z) => allZones.push(z));
  });
  const isMultiZone = allZones.length >= 2;

  const content = `# ════════════════════════════════════════════════════════════════════════════
# ORCHESTRATOR
# ════════════════════════════════════════════════════════════════════════════
#
# Control plane of your infrastructure.
#
# VM ID Ranges:
#   Soverstack: 450  (controller + UIs)
#   PDM:        455  (Proxmox Datacenter Manager)
#
# VM specs: see compute.yaml (type: infra-std)
# Customize: create apps/soverstack.yaml
#
# ════════════════════════════════════════════════════════════════════════════

soverstack:
  vm_ids: [450]
  subdomain: admin
  database: soverstack
  vpn_only: true
  admin:
    password:
      type: env
      var_name: SOVERSTACK_ADMIN_PASSWORD

pdm:
  enabled: ${isMultiZone}
  vm_ids: [455]
  subdomain: pdm
  vpn_only: true
`;

  fs.writeFileSync(filePath, content);
};
