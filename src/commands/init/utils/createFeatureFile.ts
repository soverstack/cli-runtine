import { InitOptions } from "../utils";
import fs from "fs";
import path from "path";

export const createFeatureFile = ({ projectName }: InitOptions, env?: string): void => {
  const fileName = env ? `features-${env}.yaml` : "features.yaml";
  const projectPath = path.resolve(process.cwd(), projectName);
  const filePath = path.join(projectPath, "layers/features", fileName);

  const content = `# Features Configuration${env ? ` - ${env.toUpperCase()}` : ""}

# ============================================================
# Documentation:
# https://docs.soverstack.io/configuration/features
# ============================================================

cluster_name: "${projectName}-k8s${env ? `-${env}` : ""}"

# Traefik Dashboard
traefik_dashboard:
  enabled: true
  sub_domains: "traefik"
  accessible_outside_vpn: false

# Monitoring Stack
monitoring:
  enabled: true
  prometheus: true
  grafana: true
  alertmanager: true
  sub_domains: "monitoring"

# Logging Stack
logging:
  enabled: false
  # loki: true
  # promtail: true

# Cert Manager
cert_manager:
  enabled: true
  email: "admin@example.com"
  production: ${env === "prod" ? "true" : "false"}

# Backup
backup:
  enabled: true
  schedule: "0 2 * * *" # Daily at 2 AM
  retention_days: 30
`;

  fs.writeFileSync(filePath, content);
};
