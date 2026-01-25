import fs from "fs";
import path from "path";
import { InitOptions } from "./index";

export function createObservabilityFile(options: InitOptions): void {
  // Use outputDir if provided (for services/ folder), otherwise use project root
  const targetDir = options.outputDir || path.resolve(process.cwd(), options.projectName);
  const filePath = path.join(targetDir, "observability.yaml");

  const content = generateObservabilityContent(options);

  fs.writeFileSync(filePath, content, "utf-8");
}

function generateObservabilityContent(options: InitOptions): string {
  const tier = options.infrastructureTier || "production";
  const isLocal = tier === "local";
  const isProd = tier === "production" || tier === "enterprise";

  // VM IDs based on tier (HA for production)
  const grafanaVmIds = isLocal ? "[310]" : "[310, 311]";

  return `# ════════════════════════════════════════════════════════════════════════════
# GLOBAL OBSERVABILITY
# ════════════════════════════════════════════════════════════════════════════
#
# Global dashboards. Metrics collection is REGIONAL (see regions/{region}/).
#
# VM ID Ranges:
#   Grafana:     310-319
#   Uptime Kuma: 350-359
#
# VM specs: see compute.yaml (type: observability-std)
# Customize: create apps/grafana.yaml
#
# ════════════════════════════════════════════════════════════════════════════

grafana:
  vm_ids: ${grafanaVmIds}
  subdomain: grafana
  database: grafana
  vpn_only: false
  admin:
    password:
      type: env
      var_name: GRAFANA_ADMIN_PASSWORD

uptime_kuma:
  enabled: ${isProd}
  vm_ids: [350]
  subdomain: status
  vpn_only: false
`;
}
