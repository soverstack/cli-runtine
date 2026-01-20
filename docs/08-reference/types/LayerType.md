---
id: layer-type
title: LayerType
sidebar_position: 81
---

# LayerType

Énumération des types de layers.

## Definition

```typescript
export type LayerType =
  | "datacenter"
  | "compute"
  | "cluster"
  | "database"
  | "networking"
  | "security"
  | "observability"
  | "apps";
```

## Values

| Value | Description | File |
|-------|-------------|------|
| `datacenter` | Physical Proxmox servers | `datacenter.yaml` |
| `compute` | Virtual machines | `compute.yaml` |
| `cluster` | Kubernetes cluster | `cluster.yaml` |
| `database` | PostgreSQL clusters | `databases.yaml` |
| `networking` | DNS, VPN, Firewall | `networking.yaml` |
| `security` | Vault, Keycloak | `security.yaml` |
| `observability` | Monitoring, Logging | `observability.yaml` |
| `apps` | Applications | `apps.yaml` |

## Execution Order

Layers are processed in dependency order:

1. `datacenter` - Physical servers first
2. `networking` - Firewall, VPN, DNS
3. `compute` - Virtual machines
4. `database` - PostgreSQL clusters
5. `cluster` - Kubernetes
6. `security` - Vault, Keycloak
7. `observability` - Monitoring stack
8. `apps` - Applications

## Usage

```bash
# Validate specific layer
soverstack validate --layer compute

# Plan specific layer
soverstack plan --layer database

# Apply specific layer
soverstack apply --layer cluster
```

## Related Types

- [Platform](./Platform.md)
- [CommandOptions](./CommandOptions.md)
