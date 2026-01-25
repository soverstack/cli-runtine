import { InitOptions } from "./index";
import fs from "fs";
import path from "path";

/**
 * Create apps/README.md with instructions for app customization
 */
export const createAppsReadme = ({ outputDir, projectName }: InitOptions): void => {
  const targetDir = outputDir || path.resolve(process.cwd(), projectName);
  const filePath = path.join(targetDir, "apps", "README.md");

  const content = `# App Customization

This folder is for **optional** app-specific configuration.

By default, Soverstack deploys apps with sensible defaults. Create files here only if you need to customize specific apps.

## When to use this folder

- Custom Grafana dashboards
- Custom Prometheus scrape configs or alerting rules
- Custom Keycloak realms or clients
- Custom Wazuh rules or decoders
- Custom PBS retention policies

## File naming

Create a YAML file named after the app:

\`\`\`
apps/
├── grafana.yaml      # Dashboards, datasources
├── prometheus.yaml   # Scrape configs, alerting rules
├── keycloak.yaml     # Realms, clients, mappers
├── wazuh.yaml        # Rules, decoders, active response
├── pbs.yaml          # Backup schedules, retention
└── minio.yaml        # Buckets, lifecycle policies
\`\`\`

## Example: grafana.yaml

\`\`\`yaml
# apps/grafana.yaml

dashboards:
  - proxmox-cluster
  - ceph-storage
  - postgresql
  - custom/my-dashboard.json    # Custom dashboard file

datasources:
  extra:
    - name: my-influxdb
      type: influxdb
      url: http://influxdb:8086
\`\`\`

## Example: prometheus.yaml

\`\`\`yaml
# apps/prometheus.yaml

retention: 30d
scrape_interval: 15s

extra_scrape_configs:
  - job_name: my-app
    static_configs:
      - targets: ['my-app:9090']

alerting_rules:
  - name: my-alerts
    rules:
      - alert: HighMemoryUsage
        expr: node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes < 0.1
        for: 5m
\`\`\`

## Example: keycloak.yaml

\`\`\`yaml
# apps/keycloak.yaml

realms:
  - name: my-company
    displayName: "My Company"

clients:
  - clientId: my-app
    realm: my-company
    redirectUris:
      - https://my-app.example.com/*
\`\`\`

## Notes

- Files in this folder are **merged** with defaults, not replaced
- If you don't need customization, leave this folder empty
- Soverstack validates these files during \`soverstack validate\`
`;

  fs.writeFileSync(filePath, content);
};
