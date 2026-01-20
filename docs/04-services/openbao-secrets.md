# OpenBao Secrets Management

OpenBao (fork of HashiCorp Vault) provides centralized secrets management.

## Overview

```
┌─────────────────────────────────────────────────────────────┐
│                  OpenBao Architecture                        │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │   OpenBao    │  │   OpenBao    │  │   OpenBao    │       │
│  │   Node 1     │  │   Node 2     │  │   Node 3     │       │
│  │  (vm_id:150) │  │  (vm_id:151) │  │  (vm_id:152) │       │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘       │
│         │                 │                 │                │
│         └─────────────────┼─────────────────┘                │
│                           ▼                                  │
│                   ┌──────────────┐                           │
│                   │  Raft / PG   │  Storage backend          │
│                   └──────────────┘                           │
└─────────────────────────────────────────────────────────────┘
```

## Schema

Defined by [`VaultConfig`](../08-reference/types/VaultConfig.md) interface.

## Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `enabled` | `boolean` | Yes | Enable/disable secrets management |
| `deployment` | `"vm" \| "cluster"` | Yes | Deployment mode |
| `vm_ids` | `string[]` | No | VM IDs if deployment is "vm" |
| `replicas` | `number` | No | Replica count if deployment is "cluster" |
| `storage` | `"postgresql" \| "raft"` | Yes | Storage backend type |
| `database` | `string` | No | Database cluster name (if storage is postgresql) |
| `subdomain` | `string` | No | Subdomain for Vault UI |
| `accessible_outside_vpn` | `boolean` | No | Allow public access |
| `backup` | `object` | No | Backup configuration |

## Configuration Example

```yaml
security:
  vault:
    enabled: true
    deployment: vm
    vm_ids: ["150", "151", "152"]
    storage: postgresql
    database: core-cluster
    subdomain: vault
    accessible_outside_vpn: false
    backup:
      storage_backend: minio
      schedule: "0 */4 * * *"
      retention:
        daily: 7
        weekly: 4
```

## VM ID Range

OpenBao VMs must use IDs in the **SECRETS** range:

| Range | Min | Max | Description |
|-------|-----|-----|-------------|
| SECRETS | 150 | 199 | OpenBao, Vault |

## Features

### Secret Engines
- KV v2 (versioned key-value)
- Database dynamic credentials
- PKI certificates
- SSH certificate authority

### Authentication Methods
- OIDC (via Keycloak)
- Kubernetes service accounts
- AppRole for services
- Token-based access

### Access Control
- Policy-based authorization
- Namespace isolation
- Audit logging

## Backup Configuration

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `storage_backend` | `string` | Yes | Reference to storage backend |
| `schedule` | `string` | Yes | Cron expression |
| `retention.daily` | `number` | Yes | Days to keep daily backups |
| `retention.weekly` | `number` | Yes | Weeks to keep weekly backups |

## Related Documentation

- [VaultConfig Type Reference](../08-reference/types/VaultConfig.md)
- [Security Layer](../03-layers/security.md)
- [Secrets Management](../02-architecture/security-model.md)
