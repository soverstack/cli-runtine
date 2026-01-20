# Architecture Overview

Soverstack deploys a complete infrastructure platform on Proxmox VE.

## High-Level Architecture

```
                                    ┌──────────────────────┐
                                    │     Internet         │
                                    └──────────┬───────────┘
                                               │
                              ┌────────────────┴────────────────┐
                              │         Public IP Block         │
                              │     (203.0.113.0/28 example)    │
                              └────────────────┬────────────────┘
                                               │
                    ┌──────────────────────────┼──────────────────────────┐
                    │                          │                          │
              ┌─────▼─────┐              ┌─────▼─────┐              ┌─────▼─────┐
              │  VyOS-01  │◄────VRRP────►│  VyOS-02  │              │  Ingress  │
              │ (Primary) │              │ (Backup)  │              │  (K8s)    │
              └─────┬─────┘              └─────┬─────┘              └─────┬─────┘
                    │                          │                          │
                    └──────────────────────────┼──────────────────────────┘
                                               │
              ┌────────────────────────────────┼────────────────────────────────┐
              │                         Internal Network                         │
              │                                                                  │
    ┌─────────┴─────────┐  ┌─────────────────┐  ┌─────────────────┐            │
    │     VPN Layer     │  │  Security Layer │  │   Data Layer    │            │
    │  ┌─────────────┐  │  │  ┌───────────┐  │  │  ┌───────────┐  │            │
    │  │ Headscale   │  │  │  │ Keycloak  │  │  │  │ PostgreSQL│  │            │
    │  │ (100-101)   │  │  │  │ (200-201) │  │  │  │ (250-252) │  │            │
    │  └─────────────┘  │  │  ├───────────┤  │  │  ├───────────┤  │            │
    │                   │  │  │ OpenBao   │  │  │  │   Redis   │  │            │
    │                   │  │  │ (150-151) │  │  │  │ (280-282) │  │            │
    │                   │  │  └───────────┘  │  │  └───────────┘  │            │
    └───────────────────┘  └─────────────────┘  └─────────────────┘            │
              │                                                                  │
    ┌─────────┴──────────────────────────────────────────────────────┐         │
    │                      Observability Layer                        │         │
    │  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐   │         │
    │  │Prometheus │  │  Grafana  │  │   Loki    │  │  Wazuh    │   │         │
    │  │ (300-301) │  │ (330-331) │  │ (350-351) │  │  (370)    │   │         │
    │  └───────────┘  └───────────┘  └───────────┘  └───────────┘   │         │
    └────────────────────────────────────────────────────────────────┘         │
              │                                                                  │
    ┌─────────┴──────────────────────────────────────────────────────┐         │
    │                      Kubernetes Cluster                         │         │
    │  ┌───────────────────┐    ┌────────────────────────────────┐   │         │
    │  │   Control Plane   │    │          Workers               │   │         │
    │  │   (500-502)       │    │         (600-3000)             │   │         │
    │  └───────────────────┘    └────────────────────────────────┘   │         │
    └────────────────────────────────────────────────────────────────┘         │
                                                                                │
    └───────────────────────────────────────────────────────────────────────────┘
                                        │
              ┌─────────────────────────┼─────────────────────────┐
              │                   Proxmox Cluster                  │
              │  ┌─────────┐    ┌─────────┐    ┌─────────┐        │
              │  │ PVE-01  │    │ PVE-02  │    │ PVE-03  │        │
              │  └─────────┘    └─────────┘    └─────────┘        │
              │                                                    │
              │           ┌───────────────────────┐               │
              │           │     Ceph Storage      │               │
              │           └───────────────────────┘               │
              └────────────────────────────────────────────────────┘
```

## Component Layers

### Edge Layer (VM IDs: 1-99)
- **VyOS Firewall**: Network security, NAT, VRRP failover
- **dnsdist**: DNS load balancing

### VPN Layer (VM IDs: 100-149)
- **Headscale**: Zero-trust VPN, Tailscale-compatible
- OIDC authentication enforced

### Security Layer (VM IDs: 150-249)
- **OpenBao**: Secrets management (Vault fork)
- **Keycloak**: SSO/IAM, OIDC provider

### Data Layer (VM IDs: 250-299)
- **PostgreSQL**: HA with Patroni + etcd
- **Redis**: Caching with Sentinel

### Observability Layer (VM IDs: 300-399)
- **Prometheus**: Metrics collection
- **Alertmanager**: Alert routing
- **Grafana**: Visualization
- **Loki**: Log aggregation
- **Wazuh**: SIEM/Security

### Load Balancer Layer (VM IDs: 400-449)
- **HAProxy**: TCP/HTTP load balancing

### Kubernetes Layer (VM IDs: 500-3000)
- **Control Plane**: 3+ masters for HA
- **Workers**: Scalable worker nodes
- **Cilium**: CNI with eBPF

## Data Flow

### External Access
1. Traffic hits public IP
2. VyOS firewall processes rules
3. Forwarded to internal service or VPN

### VPN Access
1. User connects to Headscale
2. OIDC authentication via Keycloak
3. Tailscale mesh network access

### Internal Services
1. All communication encrypted
2. Service discovery via DNS
3. Load balanced where applicable

## Next Steps

- [Infrastructure Tiers](./infrastructure-tiers.md) - Understand tier differences
- [VM ID Ranges](./vm-id-ranges.md) - ID conventions
- [Security Model](./security-model.md) - Security architecture
