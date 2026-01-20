# PostgreSQL with Patroni

PostgreSQL provides relational database services with Patroni for high availability.

## Overview

```
┌─────────────────────────────────────────────────────────────┐
│                 PostgreSQL HA Architecture                   │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │  PostgreSQL  │  │  PostgreSQL  │  │  PostgreSQL  │       │
│  │  Primary     │  │  Replica 1   │  │  Replica 2   │       │
│  │  (vm_id:250) │  │  (vm_id:251) │  │  (vm_id:252) │       │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘       │
│         │                 │                 │                │
│         └─────────────────┼─────────────────┘                │
│                           │                                  │
│                    ┌──────▼───────┐                          │
│                    │   Patroni    │  Consensus & failover    │
│                    │   + etcd     │                          │
│                    └──────────────┘                          │
└─────────────────────────────────────────────────────────────┘
```

## Schema

Defined by [`DatabaseCluster`](../08-reference/types/DatabaseCluster.md) interface.

## Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `type` | `"postgresql"` | Yes | Database type |
| `version` | `"14" \| "15" \| "16"` | Yes | PostgreSQL version |
| `cluster.name` | `string` | Yes | Cluster name identifier |
| `cluster.ha` | `boolean` | Yes | Enable high availability |
| `cluster.vm_ids` | `number[]` | Yes | VM IDs for cluster nodes |
| `cluster.read_replicas_vm_ids` | `number[]` | No | Additional read replica VMs |
| `port` | `number` | No | Database port (default: 5432) |
| `ssl` | `"required" \| "preferred" \| "disabled"` | Yes | SSL mode |
| `databases` | [`DatabaseDefinition[]`](../08-reference/types/DatabaseDefinition.md) | Yes | Databases to create |
| `credentials` | [`CredentialRef`](../08-reference/types/CredentialRef.md) | Yes | Credentials reference |
| `backup` | `object` | No | Backup configuration |

## Configuration Example

```yaml
databases:
  - type: postgresql
    version: "16"
    cluster:
      name: core-cluster
      ha: true
      vm_ids: [250, 251, 252]
    port: 5432
    ssl: required
    databases:
      - name: keycloak
        owner: keycloak
      - name: headscale
        owner: headscale
      - name: powerdns
        owner: powerdns
    credentials:
      type: vault
      path: "secret/database/core-cluster"
    backup:
      storage_backend: minio
      schedule: "0 2 * * *"
      retention:
        daily: 7
        weekly: 4
        monthly: 3
      type: wal_archive
```

## VM ID Range

PostgreSQL VMs must use IDs in the **DATABASE** range:

| Range | Min | Max | Description |
|-------|-----|-----|-------------|
| DATABASE | 250 | 279 | PostgreSQL |

## DatabaseDefinition

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `name` | `string` | Yes | Database name |
| `owner` | `string` | Yes | Database owner user |

## Backup Configuration

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `storage_backend` | `string` | Yes | Reference to storage backend |
| `schedule` | `string` | Yes | Cron expression |
| `retention.daily` | `number` | Yes | Days to keep daily backups |
| `retention.weekly` | `number` | Yes | Weeks to keep weekly backups |
| `retention.monthly` | `number` | Yes | Months to keep monthly backups |
| `type` | `"pg_dumpall" \| "wal_archive"` | Yes | Backup method |

## Features

### High Availability
- Automatic leader election via Patroni
- Synchronous replication for zero data loss
- Automatic failover in < 30 seconds

### Connection Pooling
- PgBouncer integrated
- Connection multiplexing
- Transaction pooling mode

### Monitoring
- pg_stat_statements enabled
- Prometheus exporter
- Query performance insights

## Related Documentation

- [DatabaseCluster Type Reference](../08-reference/types/DatabaseCluster.md)
- [Databases Layer](../03-layers/databases.md)
- [Database Failover Runbook](../07-runbooks/database-failover.md)
