---
id: services
title: Services
sidebar_position: 1
---

# Services Documentation

This section documents each service deployed by Soverstack.

## Core Infrastructure Services

| Service | Purpose | Documentation |
|---------|---------|---------------|
| [VyOS Firewall](vyos-firewall.md) | Network security, routing | Firewall rules, NAT, VPN |
| [PowerDNS](powerdns.md) | Authoritative DNS | Zone management, DNSSEC |
| [dnsdist](dnsdist.md) | DNS load balancing | Query routing, caching |

## Networking Services

| Service | Purpose | Documentation |
|---------|---------|---------------|
| [Headscale VPN](headscale-vpn.md) | Zero-trust networking | Mesh VPN, ACLs |
| [HAProxy](haproxy.md) | Load balancing | TCP/HTTP balancing |

## Security Services

| Service | Purpose | Documentation |
|---------|---------|---------------|
| [Keycloak IAM](keycloak-iam.md) | Identity management | SSO, OIDC, SAML |
| [OpenBao Secrets](openbao-secrets.md) | Secrets management | KV store, PKI, transit |

## Database Services

| Service | Purpose | Documentation |
|---------|---------|---------------|
| [PostgreSQL + Patroni](postgresql-patroni.md) | Relational database | HA, replication, backup |

## Observability Services

| Service | Purpose | Documentation |
|---------|---------|---------------|
| [Prometheus Monitoring](prometheus-monitoring.md) | Metrics collection | Scraping, alerting rules |
| [Grafana Dashboards](grafana-dashboards.md) | Visualization | Dashboards, data sources |
| [Loki Logging](loki-logging.md) | Log aggregation | LogQL, retention |
| [Wazuh SIEM](wazuh-siem.md) | Security monitoring | Threat detection, compliance |

## Service Architecture

```mermaid
graph TB
    subgraph Internet
        WAN[Internet]
    end
    
    subgraph Edge["Edge Layer"]
        FW[VyOS Firewall]
    end
    
    subgraph Services["Internal Services"]
        DNSDIST[dnsdist]
        HAPROXY[HAProxy]
        HEADSCALE[Headscale VPN]
        PDNS[PowerDNS]
        K8S[Kubernetes]
    end
    
    WAN --> FW
    FW --> DNSDIST
    FW --> HAPROXY
    FW --> HEADSCALE
    DNSDIST --> PDNS
    HAPROXY --> K8S
```

## High Availability Patterns

All production services follow HA patterns:

| Pattern | Services | Description |
|---------|----------|-------------|
| Active-Passive | VyOS, PostgreSQL | VRRP failover |
| Active-Active | dnsdist, HAProxy | Load balanced |
| Cluster | etcd, Patroni | Consensus-based |
| Mesh | Headscale, Loki | Peer-to-peer |

## Service Dependencies

```mermaid
graph TD
    A[PowerDNS] --> B[PostgreSQL]
    C[Keycloak] --> B
    D[Headscale] --> B
    E[Grafana] --> B
    E --> F[Prometheus]
    E --> G[Loki]
    F --> H[Alertmanager]
    I[OpenBao] --> B
```

## Configuration Sources

Services are configured from multiple layers:

| Layer | Provides |
|-------|----------|
| `platform.yaml` | Domain, tier, datacenter |
| `networking.yaml` | VPN, DNS, firewall rules |
| `compute.yaml` | VM specs, placement |
| `databases.yaml` | Database connections |
| `security.yaml` | IAM, secrets |
| `apps.yaml` | Subdomain routing |
