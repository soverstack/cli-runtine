# Security Layer

The security layer configures IAM (Keycloak) and secrets management (OpenBao).

## Schema

Defined by [`SecurityConfig`](../08-reference/types/SecurityConfig.md) interface.

## Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `vault` | [`VaultConfig`](#vault-config) | ❌ | OpenBao/Vault configuration |
| `sso` | [`SSOConfig`](#sso-config) | ✅ (prod) | SSO/IAM configuration |
| `cert_manager` | [`CertManagerConfig`](#cert-manager-config) | ❌ | Certificate management |

## Vault Config (OpenBao)

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `enabled` | `boolean` | ✅ | Enable secrets management |
| `deployment` | `"vm"` \| `"cluster"` | ✅ | Deployment type |
| `vm_ids` | `string[]` | ❌ | VM IDs (if vm deployment) |
| `replicas` | `number` | ❌ | Replicas (if cluster deployment) |
| `storage` | `"postgresql"` \| `"raft"` | ✅ | Storage backend |
| `database` | `string` | ❌ | Database reference (if postgresql) |
| `subdomain` | `string` | ❌ | Subdomain (e.g., `vault`) |
| `accessible_outside_vpn` | `boolean` | ❌ | Public access (default: false) |
| `backup` | object | ❌ | Backup configuration |

## SSO Config (Keycloak)

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `enabled` | `boolean` | ✅ | Enable SSO |
| `type` | `"keycloak"` \| `"authentik"` | ✅ | SSO provider |
| `deployment` | `"vm"` \| `"cluster"` | ✅ | Deployment type |
| `vm_ids` | `string[]` | ❌ | VM IDs (if vm deployment) |
| `replicas` | `number` | ❌ | Replicas (if cluster deployment) |
| `database` | `string` | ✅ | Database reference |
| `subdomain` | `string` | ❌ | Subdomain (e.g., `auth`) |
| `accessible_outside_vpn` | `boolean` | ❌ | Public access (default: false) |

## Cert Manager Config

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `enabled` | `boolean` | ✅ | Enable cert-manager |
| `email` | `string` | ✅ | Let's Encrypt email |
| `production` | `boolean` | ✅ | Use production LE |

## Complete Example

```yaml
# layers/security.yaml

# Secrets Management (OpenBao)
vault:
  enabled: true
  deployment: vm
  vm_ids: ["150", "151"]           # From core-compute.yaml
  storage: raft                     # Raft consensus storage
  subdomain: vault
  accessible_outside_vpn: false

  backup:
    storage_backend: s3-backup
    schedule: "0 4 * * *"
    retention:
      daily: 7
      weekly: 4

# SSO/IAM (Keycloak)
sso:
  enabled: true
  type: keycloak
  deployment: vm
  vm_ids: ["200", "201"]           # From core-compute.yaml
  database: keycloak               # From core-databases.yaml
  subdomain: auth
  accessible_outside_vpn: false    # VPN required for admin

# Certificate Management
cert_manager:
  enabled: true
  email: admin@example.com
  production: true                 # Use Let's Encrypt production
```

## VM ID Ranges

| Service | Range | Example IDs |
|---------|-------|-------------|
| OpenBao/Vault | 150-199 | 150, 151 |
| Keycloak | 200-249 | 200, 201 |

## Storage Options

### Raft Storage (Recommended)

```yaml
vault:
  storage: raft
```

- Self-contained, no external dependencies
- Built-in HA with leader election
- Requires odd number of nodes (3 or 5)

### PostgreSQL Storage

```yaml
vault:
  storage: postgresql
  database: openbao      # Reference to databases layer
```

- Uses PostgreSQL HA cluster
- Simpler operations
- Database dependency

## OIDC Integration

All services integrate with Keycloak:

```
User → Service → OIDC Redirect → Keycloak → MFA → Token → Service
```

### Configured Clients

| Service | Client ID | Scope |
|---------|-----------|-------|
| Grafana | `grafana` | `openid profile email` |
| Headscale | `headscale` | `openid profile email groups` |
| ArgoCD | `argocd` | `openid profile email groups` |
| Vault UI | `vault` | `openid profile` |

## Validation Rules

| Rule | Tier | Severity |
|------|------|----------|
| SSO enabled | Production+ | Critical |
| Database reference valid | All | Error |
| `accessible_outside_vpn` explicit | Production+ | Error |

## Access Control

### VPN-Only (Default)

```yaml
accessible_outside_vpn: false
```

Services only accessible via Headscale VPN.

### Public Access

```yaml
accessible_outside_vpn: true
```

**Warning**: Only enable for services that MUST be public.

## See Also

- [SecurityConfig Type](../08-reference/types/SecurityConfig.md)
- [Keycloak IAM](../04-services/keycloak-iam.md)
- [OpenBao Secrets](../04-services/openbao-secrets.md)
- [Security Model](../02-architecture/security-model.md)
