# Grafana Dashboards

Grafana provides visualization and dashboards for metrics and logs.

## Overview

```
┌─────────────────────────────────────────────────────────────┐
│                  Grafana Architecture                        │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐                         │
│  │   Grafana    │  │   Grafana    │  HA pair                │
│  │   Node 1     │  │   Node 2     │                         │
│  │  (vm_id:330) │  │  (vm_id:331) │                         │
│  └──────┬───────┘  └──────┬───────┘                         │
│         │                 │                                  │
│         └────────┬────────┘                                  │
│                  ▼                                           │
│       ┌─────────────────────┐                               │
│       │   Data Sources      │                               │
│       │  • Prometheus       │                               │
│       │  • Loki             │                               │
│       │  • PostgreSQL       │                               │
│       └─────────────────────┘                               │
└─────────────────────────────────────────────────────────────┘
```

## VM ID Range

Grafana VMs must use IDs in the **DASHBOARDS** range:

| Range | Min | Max | Description |
|-------|-----|-----|-------------|
| DASHBOARDS | 330 | 349 | Grafana |

## Features

### Data Sources
- Prometheus for metrics
- Loki for logs
- PostgreSQL for application data
- Alertmanager for alerts

### Authentication
- OIDC via Keycloak
- Role mapping from IAM groups
- Team-based access control

### Dashboards
- Pre-configured infrastructure dashboards
- Application performance dashboards
- Custom dashboard support

## Pre-installed Dashboards

| Dashboard | Description |
|-----------|-------------|
| Infrastructure Overview | Proxmox cluster health |
| Kubernetes Cluster | K8s resource utilization |
| PostgreSQL | Database performance |
| Network | Traffic and latency |

## Related Documentation

- [Observability Layer](../03-layers/observability.md)
- [Prometheus Monitoring](./prometheus-monitoring.md)
- [Loki Logging](./loki-logging.md)
