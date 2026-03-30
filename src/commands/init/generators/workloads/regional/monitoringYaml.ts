/**
 * Generate workloads/regional/{region}/monitoring.yaml
 */

import fs from "fs";
import path from "path";
import { GeneratorContext, RegionConfig, versionLine, vmId } from "../../../types";

interface MonitoringYamlOptions {
  ctx: GeneratorContext;
  region: RegionConfig;
}

export function generateMonitoringYaml({ ctx, region }: MonitoringYamlOptions): void {
  const { projectPath, options } = ctx;
  const regionId = ctx.regionIds.get(region.name) || 1;
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
  # ${!isLocal ? "HA: 2 instances scraping same targets (both have full data)" : "Single instance for local tier"}
  - role: metrics
    scope: regional
    region: ${region.name}
    implementation: victoriametrics  # victoriametrics | prometheus | mimir
${versionLine("victoriametrics")}
    instances:
      - name: metrics-${region.name}-01
        vm_id: ${vmId("regional", regionId, 0, "metrics", 0)}
        flavor: standard
        disk: 500
        image: debian-12
        host: ${nodePrefix}-01
${
  !isLocal
    ? `
      - name: metrics-${region.name}-02
        vm_id: ${vmId("regional", regionId, 0, "metrics", 1)}
        flavor: standard
        disk: 500
        image: debian-12
        host: ${nodePrefix}-02`
    : ""
}
    overwrite_config:
      # retention: 30d
      # scrape_interval: 15s
${
  !isLocal
    ? `
  # ============================================================================
  # LOGS
  # ============================================================================
  # HA: 2 instances with shared storage (MinIO)
  - role: logs
    scope: regional
    region: ${region.name}
    implementation: loki          # loki | elasticsearch | graylog
${versionLine("loki")}
    instances:
      - name: logs-${region.name}-01
        vm_id: ${vmId("regional", regionId, 0, "logs", 0)}
        flavor: standard
        disk: 500
        image: debian-12
        host: ${nodePrefix}-02

      - name: logs-${region.name}-02
        vm_id: ${vmId("regional", regionId, 0, "logs", 1)}
        flavor: standard
        disk: 500
        image: debian-12
        host: ${nodePrefix}-03
    overwrite_config:
      # retention: 30d

  # ============================================================================
  # ALERTING
  # ============================================================================
  # HA: Cluster mode with gossip protocol (critical - must not go down)
  - role: alerting
    scope: regional
    region: ${region.name}
    implementation: alertmanager  # alertmanager | grafana-alerting
${versionLine("alertmanager")}
    instances:
      - name: alerting-${region.name}-01
        vm_id: ${vmId("regional", regionId, 0, "alerting", 0)}
        flavor: small
        image: debian-12
        host: ${nodePrefix}-01

      - name: alerting-${region.name}-02
        vm_id: ${vmId("regional", regionId, 0, "alerting", 1)}
        flavor: small
        image: debian-12
        host: ${nodePrefix}-02
    overwrite_config:
      # resolve_timeout: 5m
      # smtp_smarthost: smtp.example.com:587
`
    : ""
}${
    isPrimaryRegion
      ? `
  # ============================================================================
  # DASHBOARDS
  # ============================================================================
  # Single instance OK (viewing only, not critical)
  - role: dashboards
    scope: regional
    region: ${region.name}
    implementation: grafana       # grafana | kibana
${versionLine("grafana")}
    instances:
      - name: dashboards-01
        vm_id: ${vmId("regional", regionId, 0, "dashboards", 0)}
        flavor: small
        image: debian-12
        host: ${nodePrefix}-01
    overwrite_config:
      # anonymous_enabled: false
      # auth_generic_oauth: true
`
      : ""
  }`;

  fs.writeFileSync(filePath, content.trim() + "\n");
}
