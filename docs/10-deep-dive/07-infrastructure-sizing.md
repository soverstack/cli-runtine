# Infrastructure Sizing & Tools Reference

## Overview

This document provides a comprehensive reference for Soverstack infrastructure sizing, including all tools, VM requirements, and resource planning by tier.

---

## Table of Contents

- [Complete Tool Stack](#complete-tool-stack)
- [VM Count by Tier](#vm-count-by-tier)
- [Resource Requirements](#resource-requirements)
- [Server Recommendations](#server-recommendations)
- [VM ID Ranges](#vm-id-ranges)

---

## Complete Tool Stack

### Networking

| Tool | Role | Deployment | HA |
|------|------|------------|-----|
| **VyOS** | Firewall, NAT, VRRP | VM | 2 instances |
| **Headscale** | VPN mesh (WireGuard) | VM | 2 instances |
| **PowerDNS** | Authoritative DNS | VM | 2 instances |
| **dnsdist** | DNS load balancer | VM | 2 instances |
| **HAProxy** | Edge load balancer | VM | 2 instances |

### Security

| Tool | Role | Deployment | HA |
|------|------|------------|-----|
| **Vault/OpenBao** | Secrets management, PKI | VM | 3 instances (Raft) |
| **Keycloak** | SSO, OIDC, Identity Provider | VM | 2 instances |
| **Teleport** | SSH bastion, session recording | VM | 2 instances |
| **cert-manager** | TLS certificates (Let's Encrypt) | K8s | - |
| **Step-ca** | Internal PKI (mTLS) | VM | Optional |
| **Falco** | Runtime security | Agent | All nodes |
| **Wazuh** | SIEM, compliance (PCI-DSS, GDPR) | VM | 2 instances |
| **CrowdSec** | IDS/IPS collaborative | Agent | All nodes |
| **OpenSCAP** | Vulnerability scanning | Scheduled | - |

### Observability

| Tool | Role | Deployment | HA |
|------|------|------------|-----|
| **Prometheus** | Metrics collection | VM | 2 instances |
| **Grafana** | Dashboards, visualization | VM | 2 instances |
| **Loki** | Log aggregation | VM | 3 instances |
| **Promtail** | Log shipper | Agent | All nodes |
| **Alertmanager** | Alert routing | VM | 2 instances |
| **Tempo** | Distributed tracing | VM | 2 instances (enterprise) |
| **Uptime Kuma** | Status page, uptime monitoring | VM | 1 instance |
| **Ntfy** | Push notifications (self-hosted) | VM | Optional |

### Database

| Tool | Role | Deployment | HA |
|------|------|------------|-----|
| **PostgreSQL + Patroni** | Primary database, HA cluster | VM | 3 instances |
| **Redis + Sentinel** | Cache, sessions | VM | 3 instances |

### Storage & Backup

| Tool | Role | Deployment | Location |
|------|------|------------|----------|
| **Ceph** | Distributed storage (RBD, CephFS) | Proxmox nodes | Zone |
| **PBS** | Proxmox Backup Server | Bare-metal | Hub |
| **MinIO** | S3-compatible object storage | Bare-metal | Hub |
| **Velero** | Kubernetes backup | K8s | - |

### Orchestration

| Tool | Role | Deployment | HA |
|------|------|------------|-----|
| **Soverstack CLI** | Infrastructure orchestration | VM | 1 instance |
| **PDM** | Proxmox Datacenter Manager | VM | 1 instance |
| **Terraform** | Infrastructure as Code | On orchestrator | - |
| **Ansible** | Configuration management | On orchestrator | - |

### CI/CD (Optional)

| Tool | Role | Deployment | HA |
|------|------|------------|-----|
| **Gitea** | Git server (self-hosted) | VM | 2 instances |
| **Harbor** | Container registry + scanning | VM | 2 instances |
| **ArgoCD** | GitOps for Kubernetes | K8s | - |

### Kubernetes (Optional)

| Tool | Role | Deployment | HA |
|------|------|------------|-----|
| **K3s/RKE2** | Kubernetes distribution | VM | 3 masters |
| **HAProxy** | K8s API load balancer | VM | 2 instances |
| **Traefik** | Ingress controller | K8s | 2 replicas |
| **Cilium** | CNI, network policies | K8s | - |

---

## VM Count by Tier

### Tier: LOCAL (Development)

Minimal setup, no HA, single instances.

| Category | VMs | Services |
|----------|-----|----------|
| Networking | 4 | VyOS, Headscale, PowerDNS, HAProxy |
| Security | 2 | Vault, Keycloak |
| Database | 2 | PostgreSQL, Redis |
| Observability | 3 | Prometheus, Grafana, Loki |
| Orchestrator | 1 | Soverstack |
| **TOTAL** | **12** | |

**Resources:**
- RAM: ~80 GB
- Proxmox servers: 1 (minimum)
- Hub: Not required

---

### Tier: PRODUCTION

HA for critical services, quorum for stateful services.

| Category | VMs | Services |
|----------|-----|----------|
| Networking | 10 | VyOS (2), Headscale (2), PowerDNS (2), dnsdist (2), HAProxy (2) |
| Security | 7 | Vault (3), Keycloak (2), Teleport (2) |
| Database | 6 | PostgreSQL (3), Redis (3) |
| Observability | 12 | Prometheus (2), Grafana (2), Loki (3), Alertmanager (2), Wazuh (2), Uptime Kuma (1) |
| Orchestrator | 2 | Soverstack (1), PDM (1) |
| Kubernetes | 8 | HAProxy (2), Masters (3), Workers (3) |
| **TOTAL** | **45** | |

**Resources:**
- RAM: ~320 GB (without K8s: ~220 GB)
- Proxmox servers: 3 (minimum)
- Hub: 2 servers (HDD storage)

---

### Tier: ENTERPRISE

Production + additional workers, CI/CD, tracing.

| Category | VMs | Services |
|----------|-----|----------|
| Networking | 10 | Same as production |
| Security | 7 | Same as production |
| Database | 6 | Same as production |
| Observability | 14 | Production + Tempo (2) |
| Orchestrator | 2 | Same as production |
| Kubernetes | 10 | HAProxy (2), Masters (3), Workers (5) |
| CI/CD | 4 | Harbor (2), Gitea (2) |
| **TOTAL** | **53** | |

**Resources:**
- RAM: ~500 GB
- Proxmox servers: 5+ (recommended)
- Hub: 2 servers (HDD storage)

---

## Resource Requirements

### Summary Table

| Tier | VMs | vCPUs | RAM | Storage (VMs) | Proxmox Servers | Hub Servers |
|------|-----|-------|-----|---------------|-----------------|-------------|
| Local | 12 | 30 | 80 GB | 500 GB | 1 | 0 |
| Production | 45 | 120 | 320 GB | 2 TB | 3 | 2 |
| Enterprise | 53+ | 160 | 500 GB | 3 TB | 5+ | 2 |

### Detailed VM Specifications (Production)

#### Networking

| VM | Qty | vCPU | RAM | Disk | VM IDs |
|----|-----|------|-----|------|--------|
| VyOS (firewall) | 2 | 2 | 4G | 20G | 1, 2 |
| Headscale (VPN) | 2 | 2 | 4G | 20G | 100, 101 |
| PowerDNS | 2 | 2 | 4G | 20G | 50, 51 |
| dnsdist (DNS LB) | 2 | 2 | 2G | 20G | 52, 53 |
| HAProxy (edge) | 2 | 2 | 4G | 20G | 400, 401 |

#### Security

| VM | Qty | vCPU | RAM | Disk | VM IDs |
|----|-----|------|-----|------|--------|
| Vault/OpenBao | 3 | 2 | 4G | 40G | 150, 151, 152 |
| Keycloak (SSO) | 2 | 4 | 8G | 40G | 200, 201 |
| Teleport (bastion) | 2 | 2 | 4G | 40G | 120, 121 |

#### Database

| VM | Qty | vCPU | RAM | Disk | VM IDs |
|----|-----|------|-----|------|--------|
| PostgreSQL (Patroni) | 3 | 4 | 16G | 200G | 250, 251, 252 |
| Redis (Sentinel) | 3 | 2 | 8G | 20G | 260, 261, 262 |

#### Observability

| VM | Qty | vCPU | RAM | Disk | VM IDs |
|----|-----|------|-----|------|--------|
| Prometheus | 2 | 4 | 16G | 200G | 300, 301 |
| Grafana | 2 | 2 | 4G | 50G | 310, 311 |
| Loki | 3 | 4 | 8G | 200G | 320, 321, 322 |
| Alertmanager | 2 | 2 | 2G | 20G | 330, 331 |
| Wazuh (SIEM) | 2 | 4 | 8G | 200G | 340, 341 |
| Uptime Kuma | 1 | 1 | 2G | 20G | 350 |

#### Orchestrator

| VM | Qty | vCPU | RAM | Disk | VM IDs |
|----|-----|------|-----|------|--------|
| Soverstack | 1 | 4 | 8G | 100G | 450 |
| PDM (Zone Manager) | 1 | 2 | 4G | 50G | 451 |

#### Kubernetes (Optional)

| VM | Qty | vCPU | RAM | Disk | VM IDs |
|----|-----|------|-----|------|--------|
| HAProxy (K8s API) | 2 | 2 | 4G | 20G | 410, 411 |
| K8s Masters | 3 | 4 | 8G | 50G | 500, 501, 502 |
| K8s Workers | 3 | 8 | 32G | 100G | 600, 601, 602 |

---

## Server Recommendations

### Proxmox Server (Production)

```
CPU:      AMD Ryzen 9 7950X (16 cores) or Intel Xeon
RAM:      128 GB DDR5 ECC
NVMe OS:  500 GB
NVMe Ceph: 2 TB (or more)
Network:  2x 10 GbE (1 public, 1 cluster/storage)

Estimated price: ~2,000 EUR per server
Hetzner rental: ~100 EUR/month per server
```

### Hub Server (Backup)

```
CPU:      Intel Xeon E-2388G (8 cores)
RAM:      64 GB DDR4 ECC
SSD OS:   500 GB
HDD:      4x 12TB (RAID-Z2 or ZFS mirror)
Network:  1x 10 GbE

Estimated price: ~3,000 EUR per server
Hetzner Storage Box: ~50 EUR/month for 10TB
```

### Minimum Hardware Requirements

| Tier | Proxmox Servers | Specs per Server | Hub Servers |
|------|-----------------|------------------|-------------|
| Local | 1 | 128 GB RAM, 16 cores, 2TB NVMe | None |
| Production | 3 | 128 GB RAM, 16 cores, 2TB NVMe | 2 (64GB, 50TB HDD each) |
| Enterprise | 5+ | 128 GB RAM, 32 cores, 4TB NVMe | 2 (64GB, 100TB HDD each) |

---

## VM ID Ranges

| Range | Category | Examples |
|-------|----------|----------|
| 1-49 | Firewalls | VyOS (1, 2) |
| 50-99 | DNS | PowerDNS (50, 51), dnsdist (52, 53) |
| 100-149 | VPN & Bastion | Headscale (100, 101), Teleport (120, 121) |
| 150-199 | Secrets | Vault/OpenBao (150, 151, 152) |
| 200-249 | IAM/SSO | Keycloak (200, 201) |
| 250-299 | Databases | PostgreSQL (250-252), Redis (260-262) |
| 300-399 | Observability | Prometheus (300), Grafana (310), Loki (320), Wazuh (340) |
| 400-449 | Load Balancers | HAProxy Edge (400), HAProxy K8s (410) |
| 450-499 | Tools & CI/CD | Soverstack (450), PDM (451), Gitea (460), Harbor (470) |
| 500-599 | K8s Masters | Masters (500, 501, 502) |
| 600-3000 | K8s Workers | Workers (600, 601, ...) |
| 3001+ | Applications | Custom workloads |

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              ZONE (Production)                               │
│                                                                              │
│  ╔═══════════════════════════════════════════════════════════════════════╗  │
│  ║                    VMs FOUNDATION (Proxmox HA)                        ║  │
│  ║                                                                        ║  │
│  ║   NETWORKING          SECURITY           DATABASE                     ║  │
│  ║   ───────────         ────────           ────────                     ║  │
│  ║   VyOS (2)            Vault (3)          PostgreSQL (3)               ║  │
│  ║   Headscale (2)       Keycloak (2)       Redis (3)                    ║  │
│  ║   PowerDNS (2)        Teleport (2)                                    ║  │
│  ║   dnsdist (2)                                                         ║  │
│  ║   HAProxy (2)                                                         ║  │
│  ║                                                                        ║  │
│  ║   OBSERVABILITY                          ORCHESTRATOR                 ║  │
│  ║   ─────────────                          ────────────                 ║  │
│  ║   Prometheus (2)                         Soverstack (1)               ║  │
│  ║   Grafana (2)                            PDM (1)                      ║  │
│  ║   Loki (3)                                                            ║  │
│  ║   Alertmanager (2)                                                    ║  │
│  ║   Wazuh (2)                                                           ║  │
│  ║   Uptime Kuma (1)                                                     ║  │
│  ║                                                                        ║  │
│  ╚═══════════════════════════════════════════════════════════════════════╝  │
│                                    │                                         │
│                                    ▼                                         │
│  ╔═══════════════════════════════════════════════════════════════════════╗  │
│  ║                    KUBERNETES CLUSTER (Optional)                       ║  │
│  ║                                                                        ║  │
│  ║   HAProxy (2)  →  Masters (3)  →  Workers (3+)                        ║  │
│  ║                                                                        ║  │
│  ║   Workloads: Traefik, cert-manager, ArgoCD, client apps               ║  │
│  ║                                                                        ║  │
│  ╚═══════════════════════════════════════════════════════════════════════╝  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     │ Backup (PBS, S3)
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                                   HUB                                        │
│                                                                              │
│   ┌───────────────────┐  ┌───────────────────┐                              │
│   │  Server 1 (HDD)   │  │  Server 2 (HDD)   │                              │
│   │  PBS + MinIO      │  │  PBS + MinIO      │                              │
│   │  50-100 TB        │  │  50-100 TB        │                              │
│   └───────────────────┘  └───────────────────┘                              │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Cost Comparison

### Self-Hosted (Soverstack) vs Cloud

| Item | AWS/GCP (Monthly) | Soverstack Self-Hosted |
|------|-------------------|------------------------|
| Compute (45 VMs equivalent) | ~5,000 EUR | ~300 EUR (3 servers rental) |
| Storage (2TB NVMe + 50TB HDD) | ~2,000 EUR | ~150 EUR |
| Managed DB (PostgreSQL HA) | ~1,500 EUR | Included |
| Load Balancer | ~500 EUR | Included |
| VPN | ~200 EUR | Included |
| Monitoring | ~500 EUR | Included |
| Backup (50TB) | ~1,000 EUR | ~50 EUR |
| **TOTAL** | **~10,000 EUR/month** | **~500 EUR/month** |

**Annual savings: ~115,000 EUR**

*Note: Self-hosted requires DevOps expertise. Cloud is easier but more expensive.*

---

## What You Get

### Security
- Zero-Trust architecture (VPN + SSO)
- Secrets management (Vault)
- SSH audit & session recording (Teleport)
- SIEM & compliance (Wazuh)
- Intrusion detection (CrowdSec, Falco)

### Reliability
- No single point of failure (all services HA)
- Automated failover (Patroni, VRRP, Raft)
- Multi-server Proxmox cluster with Ceph

### Observability
- Metrics (Prometheus)
- Logs (Loki)
- Dashboards (Grafana)
- Alerting (Alertmanager)
- Status page (Uptime Kuma)

### Backup & DR
- VM backups (PBS)
- Database backups (WAL archiving)
- Object storage (MinIO S3)
- Kubernetes backups (Velero)

### Compliance Ready
- PCI-DSS
- GDPR
- SOC2
- ISO 27001
- HIPAA (with additional config)
