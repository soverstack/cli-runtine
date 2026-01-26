/**
 * Generate workloads/regional/{region}/monitoring.yaml - Prometheus, Loki, Grafana
 */

import fs from "fs";
import path from "path";
import { GeneratorContext, RegionConfig } from "../../../types";

interface MonitoringYamlOptions {
  ctx: GeneratorContext;
  region: RegionConfig;
}

export function generateMonitoringYaml({ ctx, region }: MonitoringYamlOptions): void {
  const { projectPath, options } = ctx;
  const regionalDir = path.join(projectPath, "workloads", "regional", region.name);
  const filePath = path.join(regionalDir, "monitoring.yaml");

  fs.mkdirSync(regionalDir, { recursive: true });

  const primaryZone = region.zones[0];
  const nodePrefix = `pve-${region.name}-${primaryZone}`;
  const isPrimaryRegion = region.name === options.primaryRegion;
  const isLocal = options.infrastructureTier === "local";

  const content = `# ==============================================================================
# MONITORING SERVICE - ${region.name.toUpperCase()}
# ==============================================================================
#
# Metrics, logs, and dashboards. Data stays in region (GDPR).
# Location: ${region.name}/zone-${primaryZone}
#
# ==============================================================================

scope: regional
region: ${region.name}

# ------------------------------------------------------------------------------
# SERVICE DEFINITION
# ------------------------------------------------------------------------------

role: monitoring                  # What this service provides
implementation: prometheus        # prometheus | victoriametrics (coming soon)

# Version managed by Soverstack - only tested versions allowed
# Prometheus: 2.53 | Loki: 3.1 | Grafana: 11.1 | Alertmanager: 0.27

# ------------------------------------------------------------------------------
# INSTANCES
# ------------------------------------------------------------------------------

instances:
  # Prometheus (Metrics)
  - name: prometheus-${region.name}-01
    vm_id: 300
    flavor: large
    image: debian-12
    host: ${nodePrefix}-01
${!isLocal ? `
  # Loki (Logs)
  - name: loki-${region.name}-01
    vm_id: 320
    flavor: large
    image: debian-12
    host: ${nodePrefix}-02

  # Alertmanager
  - name: alertmanager-${region.name}-01
    vm_id: 330
    flavor: small
    image: debian-12
    host: ${nodePrefix}-01` : ""}
${isPrimaryRegion ? `
  # Grafana (Dashboards) - Global but deployed in primary region
  - name: grafana-01
    vm_id: 310
    flavor: standard
    image: debian-12
    host: ${nodePrefix}-01` : ""}

# ------------------------------------------------------------------------------
# CONFIGURATION OVERRIDES (optional)
# ------------------------------------------------------------------------------
# See: https://docs.soverstack.io/workloads/monitoring/prometheus

overwrite_config:
  # scheduling:
  #   strategy: auto                # manual (default) | auto
  #   host: ${nodePrefix}-01
  #
  # networks:
  #   - vlan: management
  #
  # prometheus:
  #   retention: 30d
  #   scrape_interval: 15s
  #
  # loki:
  #   retention: 30d
  #
  # grafana:
  #   anonymous_enabled: false
`;

  fs.writeFileSync(filePath, content.trim() + "\n");
}
