# Keycloak IAM

Keycloak provides identity and access management with SSO capabilities.

## Overview

```
┌─────────────────────────────────────────────────────────────┐
│                  Keycloak Architecture                       │
│                                                              │
│  ┌──────────────┐     ┌──────────────┐                      │
│  │  Keycloak    │────▶│  Keycloak    │  Active-Active HA    │
│  │  Node 1      │     │  Node 2      │                      │
│  │  (vm_id:200) │     │  (vm_id:201) │                      │
│  └──────┬───────┘     └──────┬───────┘                      │
│         │                    │                               │
│         └──────────┬─────────┘                              │
│                    ▼                                         │
│            ┌──────────────┐                                  │
│            │  PostgreSQL  │  Shared database                 │
│            └──────────────┘                                  │
└─────────────────────────────────────────────────────────────┘
```

## Schema

Defined by [`SSOConfig`](../08-reference/types/SSOConfig.md) interface.

## Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `enabled` | `boolean` | Yes | Enable/disable SSO |
| `type` | `"keycloak" \| "authentik"` | Yes | SSO provider type |
| `deployment` | `"vm" \| "cluster"` | Yes | Deployment mode |
| `vm_ids` | `string[]` | No | VM IDs if deployment is "vm" |
| `replicas` | `number` | No | Replica count if deployment is "cluster" |
| `database` | `string` | Yes | Reference to database cluster name |
| `subdomain` | `string` | No | Subdomain for Keycloak (e.g., "auth") |
| `accessible_outside_vpn` | `boolean` | No | Allow public access |

## Configuration Example

```yaml
security:
  sso:
    enabled: true
    type: keycloak
    deployment: vm
    vm_ids: ["200", "201"]
    database: core-cluster
    subdomain: auth
    accessible_outside_vpn: true
```

## VM ID Range

Keycloak VMs must use IDs in the **IAM_SSO** range:

| Range | Min | Max | Description |
|-------|-----|-----|-------------|
| IAM_SSO | 200 | 249 | Keycloak, Authentik |

## Features

### Single Sign-On
- OIDC/OAuth2 provider for all services
- SAML 2.0 support for enterprise integrations
- Social login providers (Google, GitHub, etc.)

### User Federation
- LDAP/Active Directory integration
- User attribute mapping
- Group synchronization

### Fine-Grained Authorization
- Role-based access control (RBAC)
- Resource-based permissions
- Custom policy enforcement

### Multi-Tenancy
- Realm isolation
- Per-realm themes and branding
- Tenant-specific configurations

## Integrated Services

All Soverstack services authenticate via Keycloak:

| Service | OIDC Client | Default Realm |
|---------|-------------|---------------|
| Headscale | headscale | soverstack |
| Grafana | grafana | soverstack |
| ArgoCD | argocd | soverstack |
| Vault | vault | soverstack |

## Related Documentation

- [SSOConfig Type Reference](../08-reference/types/SSOConfig.md)
- [Security Layer](../03-layers/security.md)
- [Security Model](../02-architecture/security-model.md)
