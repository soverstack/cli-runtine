import { InitOptions } from "../utils";
import fs from "fs";
import path from "path";

export const createIAMFile = ({ projectName, infrastructureTier }: InitOptions, env?: string) => {
  const fileName = env ? `iam-${env}.yaml` : "iam.yaml";
  const projectPath = path.resolve(process.cwd(), projectName);
  const filePath = path.join(projectPath, "layers/iam", fileName);

  const tier = infrastructureTier || "production";
  const isLocal = tier === "local";
  const isProduction = tier === "production";
  const isEnterprise = tier === "enterprise";

  const content = `# ############################################################
# 🔐 IDENTITY & ACCESS MANAGEMENT (IAM) CONFIGURATION ${env ? `- ${env.toUpperCase()}` : ""}
# ############################################################
# Documentation: https://docs.soverstack.io/configuration/iam
#
# IMPORTANT: IAM is MANDATORY for production and enterprise tiers
# Currently supported: Keycloak only
# Roadmap: Authentik support planned
# ############################################################

# Toggle IAM infrastructure deployment
# NOTE: Cannot be disabled for production/enterprise tiers
enabled: ${!isLocal}

# Identity Provider Type
# Current: keycloak (Enterprise-grade identity and access management)
# Roadmap: authentik (Alternative IdP)
# ⚠️ IMPORTANT: Only Keycloak is currently supported
type: "keycloak"

# Access Configuration
# This should be your CARP/VRRP Virtual IP (VIP) from your /29 subnet
public_ip: "${process.env.IAM_PUBLIC_IP || "<PUBLIC_IP>"}"

# Domain configuration for IAM services
# Example: auth.example.com, keycloak.example.com, iam.example.com
domain: "${env ? `auth-${env}.example.com` : "auth.example.com"}"

# High Availability (HA) VM Cluster
# Distributed across Proxmox nodes for 99.9% uptime
# IMPORTANT: Minimum 2 VMs required for production/enterprise
vm_configuration:
  # Reserved IDs: 250-269 for IAM services
  vm_ids: ${isLocal ? "[250]" : "[250, 251]"}  # ${isLocal ? "Single node for local" : "Master & Replica for HA"}
  os_template: "debian-12"  # Recommended for Keycloak stability
  # Available templates: https://docs.soverstack.io/configuration/iam#os-templates

# ─────────────────────────────────────────────────────────────────
# KEYCLOAK CONFIGURATION
# ─────────────────────────────────────────────────────────────────

# Database Configuration
# ⚠️ SECURITY: Store credentials in .env file
database:
  type: "postgres"  # postgres | mysql | mariadb
  host_env_var: "KEYCLOAK_DB_HOST${env ? `_${env.toUpperCase()}` : ""}"
  port: 5432
  database_name: "keycloak${env ? `_${env}` : ""}"
  username_env_var: "KEYCLOAK_DB_USER${env ? `_${env.toUpperCase()}` : ""}"
  password_env_var: "KEYCLOAK_DB_PASSWORD${env ? `_${env.toUpperCase()}` : ""}"

# Admin Configuration
# ⚠️ SECURITY: NEVER commit admin credentials
admin:
  username_env_var: "KEYCLOAK_ADMIN${env ? `_${env.toUpperCase()}` : ""}"
  password_env_var: "KEYCLOAK_ADMIN_PASSWORD${env ? `_${env.toUpperCase()}` : ""}"

# Realms Configuration
realms:
  # Master realm (Keycloak administration)
  - name: "master"
    enabled: true

  # Application realm
  - name: "${projectName}${env ? `-${env}` : ""}"
    enabled: true
    display_name: "${projectName} ${env ? env.toUpperCase() : "Application"}"

# Features Configuration
features:
  # User Federation
  user_federation:
    ldap_enabled: ${isEnterprise}
    active_directory_enabled: ${isEnterprise}

  # Social Login
  social_login:
    google_enabled: ${!isLocal}
    github_enabled: ${!isLocal}
    microsoft_enabled: ${isEnterprise}

  # Multi-Factor Authentication
  mfa:
    enabled: ${isProduction || isEnterprise}
    totp_required: ${isEnterprise}  # Time-based OTP (Google Authenticator)
    webauthn_enabled: ${isEnterprise}  # Passwordless (Yubikey, etc.)

  # Email Configuration
  email:
    enabled: ${!isLocal}
    smtp_host_env_var: "KEYCLOAK_SMTP_HOST${env ? `_${env.toUpperCase()}` : ""}"
    smtp_port: 587
    smtp_from: "noreply@example.com"
    smtp_username_env_var: "KEYCLOAK_SMTP_USER${env ? `_${env.toUpperCase()}` : ""}"
    smtp_password_env_var: "KEYCLOAK_SMTP_PASSWORD${env ? `_${env.toUpperCase()}` : ""}"

# Session Management
session:
  sso_session_idle_timeout: "${isLocal ? "30m" : "1h"}"  # Idle timeout
  sso_session_max_lifespan: "${isLocal ? "8h" : "12h"}"  # Maximum session duration
  offline_session_idle_timeout: "30d"  # Remember me duration
  remember_me: ${!isLocal}

# Clustering (for HA deployments)
clustering:
  enabled: ${!isLocal}
  cache_owners: ${isLocal ? 1 : 2}  # Number of cache replicas

# Monitoring & Metrics
monitoring:
  metrics_enabled: ${!isLocal}
  health_checks_enabled: true

# Themes
themes:
  default_theme: "keycloak"  # keycloak | custom
  # custom_theme_path: "/opt/keycloak/themes/custom"

# ─────────────────────────────────────────────────────────────────
# SECURITY BEST PRACTICES
# ─────────────────────────────────────────────────────────────────
# 1. Always use HTTPS in production
# 2. Enable MFA for admin accounts
# 3. Rotate admin credentials regularly
# 4. Use strong password policies
# 5. Enable brute force detection
# 6. Regular security audits
# 7. Keep Keycloak updated
# ─────────────────────────────────────────────────────────────────
`;

  // Create directory if it doesn't exist
  const dirPath = path.dirname(filePath);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }

  fs.writeFileSync(filePath, content);
};
