/**
 * Generate workloads/regional/{region}/monitoring.yaml - Metrics, Logs, Alerting, Dashboards
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
# MONITORING - ${region.name.toUpperCase()}
# ==============================================================================
#
# Metrics, logs, alerting, and dashboards.
# Data stays in region (GDPR compliant).
#
# ==============================================================================

services:
  # ============================================================================
  # METRICS
  # ============================================================================
  - role: metrics
    scope: regional
    region: ${region.name}
    implementation: prometheus    # prometheus | victoriametrics | mimir
    # Version: 2.53 | Supported: 2.53, 2.52, 2.51
    instances:
      - name: prometheus-${region.name}-01
        vm_id: 300
        flavor: large
        image: debian-12
        host: ${nodePrefix}-01
    overwrite_config:
      # retention: 30d
      # scrape_interval: 15s
      # storage_size: 100Gi
${!isLocal ? `
  # ============================================================================
  # LOGS
  # ============================================================================
  - role: logs
    scope: regional
    region: ${region.name}
    implementation: loki          # loki | elasticsearch | graylog
    # Version: 3.1 | Supported: 3.1, 3.0, 2.9
    instances:
      - name: loki-${region.name}-01
        vm_id: 320
        flavor: large
        image: debian-12
        host: ${nodePrefix}-02
    overwrite_config:
      # retention: 30d
      # storage_size: 100Gi

  # ============================================================================
  # ALERTING
  # ============================================================================
  - role: alerting
    scope: regional
    region: ${region.name}
    implementation: alertmanager  # alertmanager | grafana-alerting
    # Version: 0.27 | Supported: 0.27, 0.26, 0.25
    instances:
      - name: alertmanager-${region.name}-01
        vm_id: 330
        flavor: small
        image: debian-12
        host: ${nodePrefix}-01
    overwrite_config:
      # resolve_timeout: 5m
      # smtp_smarthost: smtp.example.com:587
` : ""}${isPrimaryRegion ? `
  # ============================================================================
  # DASHBOARDS
  # ============================================================================
  - role: dashboards
    scope: regional
    region: ${region.name}
    implementation: grafana       # grafana | kibana
    # Version: 11.1 | Supported: 11.1, 11.0, 10.4
    instances:
      - name: grafana-01
        vm_id: 310
        flavor: standard
        image: debian-12
        host: ${nodePrefix}-01
    overwrite_config:
      # anonymous_enabled: false
      # auth_generic_oauth: true
` : ""}
# ------------------------------------------------------------------------------
# GLOBAL OVERRIDES (optional)
# ------------------------------------------------------------------------------
# See: https://docs.soverstack.io/workloads/monitoring

overwrite_config:
  # scheduling:
  #   strategy: auto                # manual (default) | auto
  #
  # networks:
  #   - vlan: management
`;

  fs.writeFileSync(filePath, content.trim() + "\n");
}
