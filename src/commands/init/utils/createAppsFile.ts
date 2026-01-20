import { InitOptions } from "./index";
import fs from "fs";
import path from "path";

export const createAppsFile = ({ projectName, infrastructureTier, outputDir }: InitOptions): void => {
  const targetDir = outputDir || path.resolve(process.cwd(), projectName);
  const filePath = path.join(targetDir, "apps.yaml");

  const isLocal = infrastructureTier === "local";

  const content = `# ============================================================
# APPLICATIONS CONFIGURATION
# ============================================================
#
# Documentation:
# https://docs.soverstack.io/configuration/apps
#
# This layer manages user-facing applications:
# - GitLab, Nextcloud, Wiki, PgAdmin, etc.
#
# Each app specifies:
# - deployment: vm | cluster
# - database: reference to database cluster (if needed)
# - subdomain: for ingress routing
# - accessible_outside_vpn: public or VPN-only access
#
# ============================================================

# ------------------------------------------------------------
# GITLAB
# ------------------------------------------------------------
# gitlab:
#   enabled: false
#   deployment: cluster
#   replicas: 1
#   subdomain: gitlab
#   accessible_outside_vpn: false
#   database: main

# ------------------------------------------------------------
# NEXTCLOUD
# ------------------------------------------------------------
# nextcloud:
#   enabled: false
#   deployment: cluster
#   replicas: 1
#   subdomain: cloud
#   accessible_outside_vpn: false
#   database: main

# ------------------------------------------------------------
# WIKI (WikiJS)
# ------------------------------------------------------------
# wiki:
#   enabled: false
#   deployment: cluster
#   replicas: 1
#   subdomain: wiki
#   accessible_outside_vpn: false
#   database: main

# ------------------------------------------------------------
# PGADMIN
# ------------------------------------------------------------
pgadmin:
  enabled: ${isLocal}
  deployment: cluster
  replicas: 1
  subdomain: pgadmin
  accessible_outside_vpn: false

# ------------------------------------------------------------
# ARGOCD
# ------------------------------------------------------------
argocd:
  enabled: true
  deployment: cluster
  replicas: 1
  subdomain: argocd
  accessible_outside_vpn: false

# ------------------------------------------------------------
# SONARQUBE
# ------------------------------------------------------------
# sonarqube:
#   enabled: false
#   deployment: cluster
#   replicas: 1
#   subdomain: sonar
#   accessible_outside_vpn: false
#   database: main

# ------------------------------------------------------------
# NEXUS REPOSITORY
# ------------------------------------------------------------
# nexus:
#   enabled: false
#   deployment: cluster
#   replicas: 1
#   subdomain: nexus
#   accessible_outside_vpn: false

# ------------------------------------------------------------
# CUSTOM APP TEMPLATE
# ------------------------------------------------------------
# Add your own applications following this pattern:
#
# my_app:
#   enabled: true
#   deployment: cluster  # vm | cluster
#   vm_ids: []  # Required if deployment is vm
#   replicas: 1  # Required if deployment is cluster
#   subdomain: myapp
#   accessible_outside_vpn: false
#   database: main  # Optional: reference to database cluster
`;

  fs.writeFileSync(filePath, content);
};
