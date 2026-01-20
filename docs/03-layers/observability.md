# Observability Layer

The observability layer configures monitoring, logging, and alerting.

## Overview

Soverstack deploys a complete observability stack:

```
┌─────────────────────────────────────────────────────────────┐
│                      Observability Stack                     │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │  Prometheus  │  │    Loki      │  │   Wazuh      │       │
│  │  (Metrics)   │  │   (Logs)     │  │   (SIEM)     │       │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘       │
│         │                 │                 │                │
│         └────────────┬────┴────────────────┘                │
│                      │                                       │
│              ┌───────▼───────┐                              │
│              │    Grafana    │                              │
│              │ (Dashboards)  │                              │
│              └───────────────┘                              │
│                                                              │
│  ┌──────────────┐                                           │
│  │ Alertmanager │ → Email, Slack, PagerDuty                │
│  └──────────────┘                                           │
└─────────────────────────────────────────────────────────────┘
```

## Components

| Component | VM IDs | Purpose |
|-----------|--------|---------|
| Prometheus | 300-319 | Metrics collection |
| Alertmanager | 320-329 | Alert routing |
| Grafana | 330-349 | Visualization |
| Loki | 350-369 | Log aggregation |
| Wazuh | 370-399 | SIEM/Security |

## Configuration

The observability stack is configured via VMs in `core-compute.yaml` and features in `apps.yaml`.

### Prometheus

```yaml
# In apps.yaml
monitoring:
  enabled: true
  sub_domains: prometheus
  accessible_outside_vpn: false
```

Features:
- Dual-scrape for HA
- Long-term storage with Thanos (optional)
- Pre-configured service discovery

### Alertmanager

```yaml
# In apps.yaml
alerting:
  enabled: true
  sub_domains: alertmanager
  accessible_outside_vpn: false
```

Features:
- Gossip cluster for HA
- Deduplication
- Silence management

### Grafana

```yaml
# In apps.yaml
grafana:
  enabled: true
  sub_domains: grafana
  accessible_outside_vpn: false
```

Features:
- OIDC authentication (Keycloak)
- Pre-configured data sources
- Infrastructure dashboards

### Loki

```yaml
# In apps.yaml
logging:
  enabled: true
  sub_domains: loki
  accessible_outside_vpn: false
```

Features:
- Memberlist for HA
- Log aggregation from all services
- Integrated with Grafana

### Wazuh

```yaml
# In apps.yaml
siem:
  enabled: true
  sub_domains: wazuh
  accessible_outside_vpn: false
```

Features:
- Security event monitoring
- Compliance reporting
- Vulnerability detection

## VM Specifications by Tier

### Prometheus

| Tier | vCPU | RAM | Disk | Count |
|------|------|-----|------|-------|
| local | 2 | 4 GB | 50 GB | 1 |
| production | 4 | 16 GB | 100 GB | 2 |
| enterprise | 4 | 32 GB | 200 GB | 2 |

### Grafana

| Tier | vCPU | RAM | Disk | Count |
|------|------|-----|------|-------|
| local | 1 | 2 GB | 20 GB | 1 |
| production | 2 | 4 GB | 20 GB | 2 |
| enterprise | 2 | 4 GB | 20 GB | 2 |

### Loki

| Tier | vCPU | RAM | Disk | Count |
|------|------|-----|------|-------|
| local | 2 | 4 GB | 50 GB | 1 |
| production | 4 | 8 GB | 100 GB | 2 |
| enterprise | 4 | 16 GB | 200 GB | 3 |

## Data Retention

| Component | Local | Production | Enterprise |
|-----------|-------|------------|------------|
| Prometheus | 7 days | 30 days | 90 days |
| Loki | 7 days | 30 days | 90 days |
| Wazuh | 30 days | 90 days | 1 year |

## Alerting

### Alert Flow

```
Prometheus → Alertmanager → Notification Channel
                   ↓
              Silence/Inhibit
                   ↓
            Route to receiver
                   ↓
         Email/Slack/PagerDuty
```

### Default Alert Rules

| Alert | Severity | Condition |
|-------|----------|-----------|
| HighCPU | warning | CPU > 80% for 5m |
| HighMemory | warning | Memory > 85% for 5m |
| DiskSpaceLow | critical | Disk > 90% |
| ServiceDown | critical | Target down for 1m |
| PostgreSQLReplication | critical | Replication lag > 30s |

## Dashboards

Pre-configured Grafana dashboards:

| Dashboard | Description |
|-----------|-------------|
| Infrastructure Overview | All VMs, resources |
| Kubernetes Cluster | K8s metrics |
| PostgreSQL | Database performance |
| Network | Traffic, latency |
| Security | Wazuh events |

## Access

All observability services accessible via VPN:

| Service | URL |
|---------|-----|
| Grafana | `https://grafana.example.com` |
| Prometheus | `https://prometheus.example.com` |
| Alertmanager | `https://alertmanager.example.com` |

## See Also

- [Prometheus Monitoring](../04-services/prometheus-monitoring.md)
- [Grafana Dashboards](../04-services/grafana-dashboards.md)
- [Loki Logging](../04-services/loki-logging.md)
- [Wazuh SIEM](../04-services/wazuh-siem.md)
