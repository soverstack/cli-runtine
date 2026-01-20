# Prometheus Monitoring

Prometheus provides metrics collection and alerting for the entire infrastructure.

## Overview

```
┌─────────────────────────────────────────────────────────────┐
│                 Prometheus Architecture                      │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐                         │
│  │  Prometheus  │  │  Prometheus  │  HA pair                │
│  │  Primary     │  │  Secondary   │                         │
│  │  (vm_id:300) │  │  (vm_id:301) │                         │
│  └──────┬───────┘  └──────┬───────┘                         │
│         │                 │                                  │
│         └────────┬────────┘                                  │
│                  ▼                                           │
│    ┌─────────────────────────────────────┐                  │
│    │         Service Discovery           │                  │
│    │  • Proxmox VMs                      │                  │
│    │  • Kubernetes pods                  │                  │
│    │  • Consul services                  │                  │
│    └─────────────────────────────────────┘                  │
└─────────────────────────────────────────────────────────────┘
```

## VM ID Range

Prometheus VMs must use IDs in the **MONITORING** range:

| Range | Min | Max | Description |
|-------|-----|-----|-------------|
| MONITORING | 300 | 319 | Prometheus |

## Features

### Metrics Collection
- Pull-based scraping
- Service discovery
- Federation support

### Storage
- Local TSDB storage
- Long-term storage via Thanos (optional)
- Configurable retention

### Alerting
- Recording rules
- Alert rules
- Integration with Alertmanager

## Scraped Targets

| Target | Exporter | Metrics |
|--------|----------|---------|
| Proxmox nodes | pve-exporter | Node resources, VM stats |
| PostgreSQL | postgres_exporter | Query stats, replication |
| Redis | redis_exporter | Memory, connections |
| Kubernetes | kube-state-metrics | Pod, deployment status |
| Node | node_exporter | CPU, memory, disk |

## Related Documentation

- [Observability Layer](../03-layers/observability.md)
- [Grafana Dashboards](./grafana-dashboards.md)
- [Alertmanager](./alertmanager.md)
