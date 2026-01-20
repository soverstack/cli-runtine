# Redis Sentinel

Redis provides in-memory caching with Sentinel for high availability.

## Overview

```
┌─────────────────────────────────────────────────────────────┐
│                  Redis HA Architecture                       │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │   Redis      │  │   Redis      │  │   Redis      │       │
│  │   Primary    │  │   Replica 1  │  │   Replica 2  │       │
│  │  (vm_id:280) │  │  (vm_id:281) │  │  (vm_id:282) │       │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘       │
│         │                 │                 │                │
│         └─────────────────┼─────────────────┘                │
│                           │                                  │
│                    ┌──────▼───────┐                          │
│                    │  Sentinel    │  Failover & monitoring   │
│                    │  (3 nodes)   │                          │
│                    └──────────────┘                          │
└─────────────────────────────────────────────────────────────┘
```

## VM ID Range

Redis VMs must use IDs in the **CACHE** range:

| Range | Min | Max | Description |
|-------|-----|-----|-------------|
| CACHE | 280 | 299 | Redis, Valkey |

## Features

### High Availability
- Sentinel monitors primary and replicas
- Automatic failover on primary failure
- Client redirect to new primary

### Replication
- Asynchronous replication by default
- Optional synchronous for critical data
- Read replicas for scaling reads

### Persistence
- RDB snapshots
- AOF persistence
- Hybrid persistence mode

## Use Cases in Soverstack

| Service | Redis Usage |
|---------|-------------|
| Keycloak | Session cache, distributed cache |
| GitLab | CI job queues, session storage |
| Application caching | General purpose cache |

## Related Documentation

- [Databases Layer](../03-layers/databases.md)
- [Observability](../03-layers/observability.md)
