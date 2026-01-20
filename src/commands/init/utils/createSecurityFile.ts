import { InitOptions } from "./index";
import fs from "fs";
import path from "path";

export const createSecurityFile = ({
  projectName,
  infrastructureTier,
  outputDir,
}: InitOptions): void => {
  const targetDir = outputDir || path.resolve(process.cwd(), projectName);
  const filePath = path.join(targetDir, "security.yaml");

  const isLocal = infrastructureTier === "local";
  const isProd = infrastructureTier !== "local";

  const content = `# ============================================================
# SECURITY CONFIGURATION
# ============================================================
#
# Documentation: https://docs.soverstack.io/configuration/security
#
# This layer manages:
# - Vault (secrets management)
# - SSO (Keycloak/Authentik)
# - Cert Manager (TLS certificates)
#
# VM ID RANGE: 200-249 (IAM/SSO)
#
# ============================================================

# ------------------------------------------------------------
# VAULT CONFIGURATION
# ------------------------------------------------------------
# HashiCorp Vault for secrets management
#
# Storage options:
# - postgresql: Uses the PostgreSQL cluster (recommended)
# - raft: Vault's integrated storage (simpler but less features)
#
vault:
  enabled: true
  deployment: ${isLocal ? "vm" : "cluster"}
  ${isLocal ? "vm_ids: [210]         # VM ID (range: 200-249)" : "replicas: 3            # Number of Vault pods"}
  storage: postgresql     # postgresql | raft
  database: main          # Reference to database cluster
  subdomain: vault
  accessible_outside_vpn: false

  backup:
    storage_backend: backup-main
    schedule: "0 3 * * *" # Daily at 3 AM
    retention:
      daily: 7
      weekly: 4

# ------------------------------------------------------------
# SSO CONFIGURATION
# ------------------------------------------------------------
# Single Sign-On with Keycloak or Authentik
# All services authenticate via SSO (OIDC)
#
sso:
  enabled: true
  type: keycloak          # keycloak | authentik
  deployment: ${isLocal ? "vm" : "cluster"}
  ${isLocal ? "vm_ids: [200]         # VM ID (range: 200-249)" : "replicas: 2            # Number of SSO pods"}
  database: main          # Reference to database cluster
  subdomain: auth
  accessible_outside_vpn: ${isProd}  # Public for login page

# ------------------------------------------------------------
# CERT MANAGER CONFIGURATION
# ------------------------------------------------------------
# Automatic TLS certificate management (Let's Encrypt)
#
cert_manager:
  enabled: true
  email: admin@example.com  # Let's Encrypt notifications
  production: ${isProd}     # true = production certs, false = staging
`;

  fs.writeFileSync(filePath, content);
};
