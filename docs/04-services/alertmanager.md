# Alertmanager

Alertmanager handles alerts from Prometheus and routes them to appropriate channels.

## Overview

```
┌─────────────────────────────────────────────────────────────┐
│                 Alertmanager Architecture                    │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │ Alertmanager │  │ Alertmanager │  │ Alertmanager │       │
│  │   Node 1     │  │   Node 2     │  │   Node 3     │       │
│  │  (vm_id:320) │  │  (vm_id:321) │  │  (vm_id:322) │       │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘       │
│         │                 │                 │                │
│         └─────────────────┼─────────────────┘                │
│                           │                                  │
│              ┌────────────▼────────────┐                     │
│              │    Notification         │                     │
│              │  • Slack                │                     │
│              │  • Email                │                     │
│              │  • PagerDuty            │                     │
│              └─────────────────────────┘                     │
└─────────────────────────────────────────────────────────────┘
```

## VM ID Range

Alertmanager VMs must use IDs in the **ALERTING** range:

| Range | Min | Max | Description |
|-------|-----|-----|-------------|
| ALERTING | 320 | 329 | Alertmanager |

## Features

### Alert Routing
- Label-based routing
- Severity levels
- Team-based routing

### Silencing
- Temporary silences
- Regex matching
- Scheduled maintenance windows

### Grouping
- Alert aggregation
- Deduplication
- Rate limiting

## Notification Channels

| Channel | Use Case |
|---------|----------|
| Slack | Team notifications |
| Email | On-call escalation |
| PagerDuty | Critical alerts |
| Webhook | Custom integrations |

## Related Documentation

- [Observability Layer](../03-layers/observability.md)
- [Prometheus Monitoring](./prometheus-monitoring.md)
- [Incident Response Runbook](../07-runbooks/incident-response.md)
