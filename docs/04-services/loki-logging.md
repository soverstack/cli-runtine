# Loki Logging

Loki provides centralized log aggregation with efficient storage.

## Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Loki Architecture                         │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │    Loki      │  │    Loki      │  │    Loki      │       │
│  │   Node 1     │  │   Node 2     │  │   Node 3     │       │
│  │  (vm_id:350) │  │  (vm_id:351) │  │  (vm_id:352) │       │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘       │
│         │                 │                 │                │
│         └─────────────────┼─────────────────┘                │
│                           ▼                                  │
│                   ┌──────────────┐                           │
│                   │   S3/MinIO   │  Object storage           │
│                   └──────────────┘                           │
└─────────────────────────────────────────────────────────────┘
```

## VM ID Range

Loki VMs must use IDs in the **LOGGING** range:

| Range | Min | Max | Description |
|-------|-----|-----|-------------|
| LOGGING | 350 | 369 | Loki |

## Features

### Log Collection
- Promtail agent on all nodes
- Kubernetes pod logs via sidecar
- Syslog ingestion

### Storage
- Index-free design (labels only)
- Compressed chunks in object storage
- Retention policies

### Query
- LogQL query language
- Live tailing
- Context-aware filtering

## Log Sources

| Source | Collection Method | Labels |
|--------|------------------|--------|
| VMs | Promtail | job, host, service |
| Kubernetes | Promtail DaemonSet | namespace, pod, container |
| Applications | Direct push | app, environment |

## Related Documentation

- [Observability Layer](../03-layers/observability.md)
- [Grafana Dashboards](./grafana-dashboards.md)
- [Wazuh SIEM](./wazuh-siem.md)
