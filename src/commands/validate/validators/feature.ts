import { Feature, InfrastructureTierType } from "../../../types";
import { ValidationResult, ValidationContext, addError, addWarning } from "../utils/types";
import { validateAccessibleOutsideVpn } from "../rules/security";

/**
 * Validates features configuration
 */
export function validateFeature(
  feature: Feature,
  context: ValidationContext,
  result: ValidationResult,
  infrastructureTier: InfrastructureTierType
): void {
  const layer = "features";

  // Validate cluster name
  if (!feature.cluster_name) {
    addError(
      result,
      layer,
      "cluster_name",
      "Cluster name is required",
      "critical",
      "Specify which cluster these features should be deployed to"
    );
  } else {
    // Check if cluster exists
    if (!context.cluster_names.has(feature.cluster_name)) {
      addError(
        result,
        layer,
        "cluster_name",
        `Cluster "${feature.cluster_name}" not found`,
        "error",
        `Available clusters: ${Array.from(context.cluster_names).join(", ") || "none"}`
      );
    }
  }

  // Validate individual features
  // Each feature should have explicit accessible_outside_vpn setting

  // Traefik Dashboard
  if (feature.traefik_dashboard?.enabled) {
    validateAccessibleOutsideVpn(
      feature.traefik_dashboard.accessible_outside_vpn,
      "traefik_dashboard",
      result,
      layer
    );

    if (!feature.traefik_dashboard.sub_domains) {
      addWarning(
        result,
        layer,
        "traefik_dashboard.sub_domains",
        "Subdomain not configured for Traefik dashboard",
        'Add sub_domains (e.g., "traefik")'
      );
    }
  }

  // SSO
  if (feature.sso?.enabled) {
    validateAccessibleOutsideVpn(feature.sso.accessible_outside_vpn, "sso", result, layer);

    if (!feature.sso.type) {
      addError(
        result,
        layer,
        "sso.type",
        "SSO type is required when enabled",
        "error",
        'Choose "authentik" or "keycloak"'
      );
    } else if (!["keycloak", "authentik"].includes(feature.sso.type)) {
      addError(
        result,
        layer,
        "sso.type",
        `Invalid SSO type: ${feature.sso.type}`,
        "error",
        'Must be "authentik" or "keycloak"'
      );
    }
  }

  // Vault
  if (feature.vault?.enabled) {
    validateAccessibleOutsideVpn(feature.vault.accessible_outside_vpn, "vault", result, layer);
  }

  // Mail
  if (feature.mail?.enabled) {
    validateAccessibleOutsideVpn(feature.mail.accessible_outside_vpn, "mail", result, layer);

    if (!feature.mail.domains) {
      addError(
        result,
        layer,
        "mail.domains",
        "Email domains are required when mail is enabled",
        "error",
        'Add domains (e.g., "example.com")'
      );
    }
  }

  // Monitoring
  if (feature.monitoring?.enabled) {
    validateAccessibleOutsideVpn(
      feature.monitoring.accessible_outside_vpn,
      "monitoring",
      result,
      layer
    );
  }

  // Velero
  if (feature.velero?.enabled) {
    validateAccessibleOutsideVpn(feature.velero.accessible_outside_vpn, "velero", result, layer);
  }

  // PostgreSQL Operator
  if (feature.postgres_operator?.enabled) {
    validateAccessibleOutsideVpn(
      feature.postgres_operator.accessible_outside_vpn,
      "postgres_operator",
      result,
      layer
    );
  }

  // ArgoCD
  if (feature.argocd?.enabled) {
    validateAccessibleOutsideVpn(feature.argocd.accessible_outside_vpn, "argocd", result, layer);
  }

  // GitLab
  if (feature.gitlab?.enabled) {
    validateAccessibleOutsideVpn(feature.gitlab.accessible_outside_vpn, "gitlab", result, layer);
  }

  // PgAdmin
  if (feature.pg_admin?.enabled) {
    validateAccessibleOutsideVpn(
      feature.pg_admin.accessible_outside_vpn,
      "pg_admin",
      result,
      layer
    );
  }

  // Nextcloud
  if (feature.nextcloud?.enabled) {
    validateAccessibleOutsideVpn(
      feature.nextcloud.accessible_outside_vpn,
      "nextcloud",
      result,
      layer
    );
  }

  // Wiki
  if (feature.wiki?.enabled) {
    validateAccessibleOutsideVpn(feature.wiki.accessible_outside_vpn, "wiki", result, layer);
  }

  // SonarQube
  if (feature.sonarqube?.enabled) {
    validateAccessibleOutsideVpn(
      feature.sonarqube.accessible_outside_vpn,
      "sonarqube",
      result,
      layer
    );
  }

  // Nexus
  if (feature.nexus?.enabled) {
    validateAccessibleOutsideVpn(feature.nexus.accessible_outside_vpn, "nexus", result, layer);
  }
}
