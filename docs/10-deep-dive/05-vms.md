# Infrastructure Architecture - VMs & Services

## Overview

This document defines the **production-ready** infrastructure architecture for Soverstack, including all VMs, services, network design, and bootstrap sequence.

---

## Table of Contents

- [Architecture Principles](#architecture-principles)
- [Global Architecture](#global-architecture)
- [Bootstrap Sequence](#bootstrap-sequence)
- [VM vs Kubernetes Decision](#vm-vs-kubernetes-decision)
- [Network Design](#network-design)
- [VM Specifications](#vm-specifications)
- [VM ID Ranges](#vm-id-ranges)
- [Production Checklist](#production-checklist)

---

## Architecture Principles

### 1. Foundation First

Some services **must** run as VMs because they are required before Kubernetes can exist:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           BOOTSTRAP DEPENDENCY                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   Firewall (VyOS)     ← Network must exist first                            │
│        ↓                                                                     │
│   DNS (PowerDNS)      ← Name resolution for everything                      │
│        ↓                                                                     │
│   Database (PostgreSQL) ← Storage for all services                          │
│        ↓                                                                     │
│   VPN (Headscale)     ← Secure access before anything else                  │
│        ↓                                                                     │
│   Secrets (Vault)     ← Credentials for K8s bootstrap                       │
│        ↓                                                                     │
│   SSO (Keycloak)      ← Identity for everything (including Proxmox)         │
│        ↓                                                                     │
│   Monitoring          ← Must see VMs, not just K8s                          │
│        ↓                                                                     │
│   Kubernetes          ← Now we can create K8s                               │
│        ↓                                                                     │
│   Workloads           ← Client applications                                 │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2. Global Services in VMs

These services are **global** (not just for K8s) and must run as VMs:

| Service | Why VM? |
|---------|---------|
| **Keycloak** | SSO for Proxmox, VPN, Grafana, Vault, everything |
| **Prometheus** | Monitors VMs, Proxmox, Ceph, not just K8s |
| **Grafana** | Dashboards for entire infrastructure |
| **Loki** | Logs from VMs, system logs, not just K8s pods |

**If K8s dies and these services are inside K8s:**
- No login to Proxmox
- No VPN access
- No monitoring visibility
- Complete blindness

### 3. Kubernetes for Workloads

Kubernetes is for **client workloads**, not Soverstack infrastructure:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                              │
│   SOVERSTACK (VMs)              Creates & Manages            KUBERNETES     │
│   ════════════════              ═══════════════════          ══════════     │
│                                                                              │
│   Terraform + Ansible  ─────────────────────────────────►   K8s Cluster    │
│                                                                              │
│   Manages:                                                   Runs:          │
│   • VMs                                                      • Client apps  │
│   • Proxmox                                                  • Ingress      │
│   • Network                                                  • Operators    │
│   • Foundation services                                      • ArgoCD       │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Global Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              EDGE LAYER                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│    VyOS Firewall (2x HA/VRRP)  →  HAProxy Edge (2x HA)                      │
│         Public IPs                    SNI Routing                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                           ZERO-TRUST LAYER                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│    Headscale (2x)  ←→  Keycloak (2x)  ←→  Vault (3x)  ←→  Teleport (2x)    │
│       VPN Mesh          SSO/OIDC          Secrets          SSH Bastion      │
├─────────────────────────────────────────────────────────────────────────────┤
│                              DNS LAYER                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│    dnsdist (2x HA)  →  PowerDNS (2x HA)  →  PostgreSQL                      │
│      DNS LB              Authoritative         Backend                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                           DATABASE LAYER                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│    PostgreSQL (3x Patroni)  ←→  Redis (3x Sentinel)                         │
│         Primary DB                Cache & Sessions                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                         OBSERVABILITY LAYER                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│    Prometheus (2x)  →  Grafana (2x)  →  Alertmanager (2x)                   │
│    Loki (3x)        →  Wazuh (2x)    →  Uptime Kuma (1x)                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                          KUBERNETES LAYER                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│    HAProxy K8s (2x)  →  Masters (3x)  →  Workers (3x+)                      │
│       API LB             Control Plane      Workloads                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                          ORCHESTRATOR LAYER                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│    Soverstack (1x)  →  PDM (1x)                                             │
│    Terraform/Ansible    Proxmox Datacenter Manager                          │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ Backup
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                               HUB LAYER                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│    PBS (2x)  →  MinIO (2x)  →  Off-site replication                         │
│    VM Backup    S3 Storage      Disaster Recovery                            │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Bootstrap Sequence

### Phase 0: Bare Metal

Admin installs Proxmox on physical servers and creates Ceph cluster.

```
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│  Server 1   │  │  Server 2   │  │  Server 3   │
│  Proxmox    │  │  Proxmox    │  │  Proxmox    │
│  + Ceph OSD │  │  + Ceph OSD │  │  + Ceph OSD │
└─────────────┘  └─────────────┘  └─────────────┘
```

### Phase 1: Foundation (from Admin Laptop)

```bash
soverstack apply --phase foundation
```

Creates (in order):
1. **VyOS** - Network gateway
2. **PowerDNS + dnsdist** - DNS resolution
3. **PostgreSQL** - Database for all services
4. **Redis** - Cache and sessions
5. **Vault** - Secrets management
6. **Headscale** - VPN access
7. **Keycloak** - SSO for everything
8. **Teleport** - SSH bastion
9. **Orchestrator VM** - Soverstack moves here

### Phase 2: Observability (from Orchestrator VM)

```bash
soverstack apply --phase observability
```

Creates:
1. **Prometheus** - Metrics
2. **Grafana** - Dashboards
3. **Loki** - Logs
4. **Alertmanager** - Alerts
5. **Wazuh** - SIEM
6. **Uptime Kuma** - Status page

### Phase 3: Kubernetes (Optional)

```bash
soverstack apply --phase kubernetes
```

Creates:
1. **HAProxy** - K8s API load balancer
2. **K8s Masters** - Control plane
3. **K8s Workers** - Compute nodes

### Phase 4: Services in K8s

```bash
soverstack apply --phase k8s-services
```

Deploys:
1. **Traefik** - Ingress controller
2. **cert-manager** - TLS certificates
3. **ArgoCD** - GitOps (optional)

---

## VM vs Kubernetes Decision

### Must be VMs (Foundation)

| Service | Reason |
|---------|--------|
| VyOS | Network must exist before anything |
| PowerDNS | DNS required for K8s to work |
| PostgreSQL | Stateful, critical data |
| Redis | Sessions for Keycloak |
| Vault | Secrets for K8s bootstrap |
| Headscale | VPN access before K8s exists |
| Keycloak | SSO for Proxmox, not just K8s |
| Teleport | SSH access to all VMs |
| Prometheus | Monitors VMs, not just K8s |
| Grafana | Dashboards for everything |
| Loki | Logs from VMs |
| Orchestrator | Creates K8s, can't be inside it |

### Can be in Kubernetes (After K8s exists)

| Service | Reason |
|---------|--------|
| Traefik | K8s-native ingress |
| cert-manager | K8s certificates |
| ArgoCD | GitOps for K8s workloads |
| Client apps | What K8s is for |
| DBaaS operators | CloudNativePG, Redis Operator |

---

## Network Design

### VLANs

| Network | VLAN | CIDR | Purpose | MTU |
|---------|------|------|---------|-----|
| Management | 10 | 10.0.1.0/24 | SSH, Proxmox UI, Ansible | 1500 |
| Proxmox Cluster | 20 | 10.0.2.0/24 | Corosync, Live Migration | 9000 |
| Storage | 30 | 10.0.3.0/24 | Ceph, MinIO, NFS | 9000 |
| Infrastructure | 40 | 10.0.4.0/24 | Foundation VMs | 1500 |
| Kubernetes | 50 | 10.0.5.0/24 | K8s nodes | 1500 |
| K8s Pods | - | 10.244.0.0/16 | CNI (Cilium/Calico) | - |
| K8s Services | - | 10.96.0.0/12 | ClusterIP | - |
| Public | - | Provider block | Public IPs (VRRP) | 1500 |

### IP Allocation (Infrastructure VLAN)

```
10.0.4.0/24 - Infrastructure VMs

.1      VyOS Gateway
.10-19  Firewall VMs (VyOS)
.20-29  DNS VMs (PowerDNS, dnsdist)
.30-39  Database VMs (PostgreSQL, Redis)
.40-49  Security VMs (Vault, Keycloak, Teleport)
.50-59  VPN VMs (Headscale)
.60-79  Observability VMs (Prometheus, Grafana, Loki, etc.)
.80-89  Load Balancer VMs (HAProxy)
.90-99  Orchestrator VMs (Soverstack, PDM)
.100+   Reserved
```

---

## VM Specifications

### Production Tier (45 VMs)

#### Networking (10 VMs)

| VM | Qty | vCPU | RAM | Disk | VM IDs | HA Mechanism |
|----|-----|------|-----|------|--------|--------------|
| VyOS | 2 | 2 | 4G | 20G | 1, 2 | VRRP |
| Headscale | 2 | 2 | 4G | 20G | 100, 101 | LB + shared DB |
| PowerDNS | 2 | 2 | 4G | 20G | 50, 51 | LB + shared DB |
| dnsdist | 2 | 2 | 2G | 20G | 52, 53 | Keepalived |
| HAProxy Edge | 2 | 2 | 4G | 20G | 400, 401 | Keepalived |

#### Security (7 VMs)

| VM | Qty | vCPU | RAM | Disk | VM IDs | HA Mechanism |
|----|-----|------|-----|------|--------|--------------|
| Vault/OpenBao | 3 | 2 | 4G | 40G | 150, 151, 152 | Raft consensus |
| Keycloak | 2 | 4 | 8G | 40G | 200, 201 | Infinispan cluster |
| Teleport | 2 | 2 | 4G | 40G | 120, 121 | LB + shared DB |

#### Database (6 VMs)

| VM | Qty | vCPU | RAM | Disk | VM IDs | HA Mechanism |
|----|-----|------|-----|------|--------|--------------|
| PostgreSQL | 3 | 4 | 16G | 200G | 250, 251, 252 | Patroni + etcd |
| Redis | 3 | 2 | 8G | 20G | 260, 261, 262 | Sentinel |

#### Observability (12 VMs)

| VM | Qty | vCPU | RAM | Disk | VM IDs | HA Mechanism |
|----|-----|------|-----|------|--------|--------------|
| Prometheus | 2 | 4 | 16G | 200G | 300, 301 | Dual scrape |
| Grafana | 2 | 2 | 4G | 50G | 310, 311 | LB + shared DB |
| Loki | 3 | 4 | 8G | 200G | 320, 321, 322 | Memberlist |
| Alertmanager | 2 | 2 | 2G | 20G | 330, 331 | Gossip cluster |
| Wazuh | 2 | 4 | 8G | 200G | 340, 341 | Cluster mode |
| Uptime Kuma | 1 | 1 | 2G | 20G | 350 | - |

#### Orchestrator (2 VMs)

| VM | Qty | vCPU | RAM | Disk | VM IDs | HA Mechanism |
|----|-----|------|-----|------|--------|--------------|
| Soverstack | 1 | 4 | 8G | 100G | 450 | - |
| PDM | 1 | 2 | 4G | 50G | 451 | - |

#### Kubernetes (8 VMs)

| VM | Qty | vCPU | RAM | Disk | VM IDs | HA Mechanism |
|----|-----|------|-----|------|--------|--------------|
| HAProxy K8s | 2 | 2 | 4G | 20G | 410, 411 | Keepalived |
| K8s Master | 3 | 4 | 8G | 50G | 500, 501, 502 | etcd Raft |
| K8s Worker | 3 | 8 | 32G | 100G | 600, 601, 602 | ReplicaSets |

### Resource Totals

| Tier | VMs | vCPUs | RAM | Storage |
|------|-----|-------|-----|---------|
| Local | 12 | 30 | 80 GB | 500 GB |
| Production | 45 | 120 | 320 GB | 2 TB |
| Enterprise | 53+ | 160 | 500 GB | 3 TB |

---

## VM ID Ranges

| Range | Category | Services |
|-------|----------|----------|
| 1-49 | Firewalls | VyOS (1-10) |
| 50-99 | DNS | PowerDNS (50-59), dnsdist (60-69) |
| 100-149 | VPN & Bastion | Headscale (100-109), Teleport (120-129) |
| 150-199 | Secrets | Vault/OpenBao (150-159) |
| 200-249 | IAM/SSO | Keycloak (200-209) |
| 250-299 | Databases | PostgreSQL (250-259), Redis (260-269) |
| 300-399 | Observability | Prometheus (300-309), Grafana (310-319), Loki (320-329), Alertmanager (330-339), Wazuh (340-349), Uptime Kuma (350-359) |
| 400-449 | Load Balancers | HAProxy Edge (400-409), HAProxy K8s (410-419) |
| 450-499 | Tools & CI/CD | Soverstack (450), PDM (451), Gitea (460-469), Harbor (470-479) |
| 500-599 | K8s Masters | Masters (500-509) |
| 600-3000 | K8s Workers | Workers (600+) |
| 3001+ | Applications | Custom workloads |

---

## Production Checklist

### High Availability

- [ ] All critical services have 2+ instances
- [ ] VRRP configured for public IPs (VyOS)
- [ ] Quorum respected: etcd (3), Patroni (3), Vault (3)
- [ ] Ceph has 3+ OSDs with replication factor 3
- [ ] Proxmox HA enabled for critical VMs

### Security

- [ ] Zero-Trust: VPN (Headscale) + SSO (Keycloak) for all access
- [ ] Vault for secrets management
- [ ] Teleport for SSH audit and session recording
- [ ] Wazuh (SIEM) + Falco (runtime) deployed
- [ ] CrowdSec agents on all nodes
- [ ] Network policies enforced

### Observability

- [ ] Prometheus scraping all targets
- [ ] Grafana dashboards configured
- [ ] Loki collecting logs from all sources
- [ ] Alertmanager with notification channels
- [ ] Uptime Kuma status page public

### Backup & DR

- [ ] PBS backing up all VMs to Hub
- [ ] PostgreSQL WAL archiving to MinIO
- [ ] Backup retention configured (7 daily, 4 weekly, 12 monthly)
- [ ] Restore tested and documented
- [ ] Hub has 2 servers for redundancy

### Compliance

- [ ] Audit logs enabled (auditd, Falco)
- [ ] Log retention meets requirements (2 years for regulated)
- [ ] Wazuh compliance rules enabled (PCI-DSS, GDPR, etc.)
- [ ] OpenSCAP scans scheduled

---

## Server Requirements

### Proxmox Servers (Zone)

```
Minimum: 3 servers
Recommended specs per server:
- CPU: 16+ cores (AMD Ryzen 9 / Intel Xeon)
- RAM: 128 GB DDR5 ECC
- NVMe OS: 500 GB
- NVMe Ceph: 2+ TB
- Network: 2x 10 GbE
```

### Hub Servers (Backup)

```
Minimum: 2 servers
Recommended specs per server:
- CPU: 8+ cores
- RAM: 64 GB DDR4 ECC
- SSD OS: 500 GB
- HDD Storage: 4x 12TB (RAID-Z2)
- Network: 1x 10 GbE
```

---

## Quick Reference

### Services by Priority

| Priority | Services | Why |
|----------|----------|-----|
| P0 - Critical | VyOS, PostgreSQL, Vault | Infrastructure foundation |
| P1 - Essential | DNS, Headscale, Keycloak | Access and identity |
| P2 - Important | Prometheus, Grafana, Loki | Visibility |
| P3 - Standard | Wazuh, Teleport, Alertmanager | Security and alerts |
| P4 - Optional | K8s, ArgoCD, Harbor | Workload platform |

### Default Ports

| Service | Port | Protocol |
|---------|------|----------|
| Proxmox UI | 8006 | HTTPS |
| Headscale | 443, 41641 | HTTPS, UDP |
| Keycloak | 443 | HTTPS |
| Vault | 8200 | HTTPS |
| Grafana | 3000 | HTTPS |
| Prometheus | 9090 | HTTP |
| PostgreSQL | 5432 | TCP |
| Redis | 6379 | TCP |
| K8s API | 6443 | HTTPS |
