---
id: feature
title: Feature
sidebar_position: 61
---

# Feature

Configuration des fonctionnalités des applications et services Kubernetes.

## Definition

```typescript
export interface Feature {
  cluster_name: string;

  traefik_dashboard?: {
    enabled: boolean;
    sub_domains: string;
    accessible_outside_vpn: boolean;
  };

  sso?: {
    enabled: boolean;
    type: "keycloak" | "authentik";
    sub_domains: string;
    accessible_outside_vpn: boolean;
  };

  vault?: {
    enabled: boolean;
    sub_domains: string;
    accessible_outside_vpn: boolean;
  };

  monitoring?: {
    enabled: boolean;
    sub_domains: string;
    accessible_outside_vpn: boolean;
  };

  argocd?: {
    enabled: boolean;
    sub_domains: string;
    accessible_outside_vpn: boolean;
  };

  // ... and more applications
}
```

## Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `cluster_name` | `string` | Yes | Target Kubernetes cluster |

## Application Feature

Each application feature has:

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `enabled` | `boolean` | Yes | Enable/disable feature |
| `sub_domains` | `string` | Yes | Subdomain for the service |
| `accessible_outside_vpn` | `boolean` | Yes | Allow public access |

## Available Features

| Feature | Description |
|---------|-------------|
| `traefik_dashboard` | Traefik dashboard UI |
| `sso` | Keycloak/Authentik SSO |
| `vault` | OpenBao secrets UI |
| `monitoring` | Grafana dashboards |
| `velero` | Backup management |
| `argocd` | GitOps deployments |
| `gitlab` | GitLab instance |
| `pg_admin` | PostgreSQL admin |
| `nextcloud` | File storage |
| `wiki` | Wiki system |
| `sonarqube` | Code quality |
| `nexus` | Artifact repository |

## Example

```yaml
features:
  cluster_name: production

  traefik_dashboard:
    enabled: true
    sub_domains: traefik
    accessible_outside_vpn: false

  monitoring:
    enabled: true
    sub_domains: grafana
    accessible_outside_vpn: false

  argocd:
    enabled: true
    sub_domains: argocd
    accessible_outside_vpn: false

  gitlab:
    enabled: true
    sub_domains: gitlab
    accessible_outside_vpn: true
```

## Related Types

- [AppsConfig](./AppsConfig.md)
- [K8sCluster](./K8sCluster.md)
