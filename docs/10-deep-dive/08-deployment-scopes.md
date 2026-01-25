# Deployment Scopes: Global, Regional, Zone

This document explains where services run in a Soverstack infrastructure and why.

## Overview

Soverstack organizes infrastructure into three scopes:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              GLOBAL                                         │
│                    (unique across entire platform)                          │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         REGION (eu, us, asia)                        │   │
│  │                                                                      │   │
│  │   ┌──────────────────┐    ┌──────────────────────────────────────┐  │   │
│  │   │       HUB        │    │              ZONES                    │  │   │
│  │   │    (backup)      │    │  ┌──────────┐  ┌──────────┐          │  │   │
│  │   │                  │    │  │   main   │  │    dr    │  ...     │  │   │
│  │   │  PBS, MinIO      │    │  │ (prod)   │  │ (disaster│          │  │   │
│  │   │  HDD servers     │    │  │          │  │ recovery)│          │  │   │
│  │   └──────────────────┘    │  └──────────┘  └──────────┘          │  │   │
│  │                           └──────────────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Why This Matters

**Not all services are equal.** Some must exist before anything else (DNS, auth), some monitor entire regions, and some are specific to a production cluster.

### The Chicken-and-Egg Problem

Consider Keycloak (SSO). If you put it in Kubernetes:
- K8s needs auth to pull images → needs Keycloak
- Keycloak runs in K8s → needs K8s running first
- **Deadlock!**

Solution: Keycloak runs as a **global VM**, deployed before K8s exists.

---

## GLOBAL Scope

**Definition:** Services that are unique across the entire platform. Only ONE instance exists, regardless of how many regions or zones you have.

**Deployed on:** The `control_plane_runs_on` zone (typically your primary zone).

### Global Services

| Service | Purpose | Why Global |
|---------|---------|------------|
| **PowerDNS** | Authoritative DNS | Single source of truth for DNS records |
| **dnsdist** | DNS load balancer | Routes DNS queries to PowerDNS |
| **Headscale** | VPN coordination | Single control plane for mesh network |
| **Vault** | Secrets management | Single source of truth for secrets |
| **Keycloak** | Identity & SSO | Single identity provider for everything |
| **PostgreSQL** | Shared database | Stores data for global services |
| **Grafana** | Dashboards | Single pane of glass for all metrics |
| **Soverstack** | Orchestration | Controls the entire platform |
| **PDM** | Proxmox management | Manages all Proxmox clusters |

### Global Files

```
project/
├── platform.yaml          # Root configuration
├── orchestrator.yaml      # Soverstack, PDM config
├── security.yaml          # Vault, Keycloak
├── networking.yaml        # Headscale, PowerDNS
├── observability.yaml     # Grafana config
├── core-compute.yaml      # Global VMs
└── core-database.yaml     # PostgreSQL cluster
```

### Global VM Count

| Tier | VMs |
|------|-----|
| Local | 9 |
| Production | 17 |
| Enterprise | 17 |

---

## REGIONAL Scope

**Definition:** Services deployed once per region. If you have regions `eu` and `us`, you have two instances of each regional service.

**Purpose:** Keep monitoring data close to what it monitors. Reduce latency. Comply with data residency laws (GDPR = EU data stays in EU).

### Regional Services

| Service | Purpose | Why Regional |
|---------|---------|--------------|
| **Teleport** | SSH bastion | GDPR: session recordings stay in region |
| **Prometheus** | Metrics collection | Scrapes all VMs/K8s in the region |
| **Loki** | Log aggregation | Collects logs from entire region |
| **Alertmanager** | Alert routing | Sends notifications for region |
| **Wazuh** | SIEM / Security | GDPR: security logs stay in region |

### Why Not Global?

If Prometheus was global and you have EU + US regions:
- **Latency:** Scraping US servers from EU = slow, unreliable
- **Bandwidth:** Cross-region traffic is expensive
- **GDPR:** EU logs might not be allowed to leave EU

**Teleport specifically** is regional because SSH session recordings contain user activity data. Under GDPR, this data must stay in the region where the user operates.

### Regional Files

```
regions/eu/
├── region.yaml            # Region configuration
└── core-compute.yaml      # Teleport, Prometheus, Loki, Wazuh VMs
```

### Regional VM Count

| Service | Local | Production |
|---------|-------|------------|
| Teleport | 1 | 2 (HA) |
| Prometheus | 1 | 1 |
| Loki | 1 | 1 |
| Alertmanager | 1 | 1 |
| Wazuh | 1 | 1 |
| **Total** | **5** | **6** |

---

## HUB Scope

**Definition:** Backup infrastructure for a region. One hub per region.

**Hardware:** HDD-based servers (cheap, high capacity). NOT NVMe.

### Hub Services

| Service | Purpose |
|---------|---------|
| **PBS** | Proxmox Backup Server - VM snapshots |
| **MinIO** | S3-compatible storage for WAL, Velero |

### Why Separate Hub?

1. **Cost:** HDD storage is 5-10x cheaper than NVMe
2. **Isolation:** Backup corruption shouldn't affect production
3. **Different SLA:** Backups don't need <1ms latency

### Hub Files

```
regions/eu/
└── hub/
    └── cluster.yaml       # PBS, MinIO, HDD servers
```

### Hub VM Count

| Service | VMs |
|---------|-----|
| PBS | 1 |
| MinIO | 1 |
| **Total** | **2** |

---

## ZONE Scope

**Definition:** Production Proxmox cluster. Multiple zones per region for HA or workload separation.

**Hardware:** NVMe servers with Ceph for fast storage.

### Zone Types

| Zone | Purpose | Example |
|------|---------|---------|
| `main` | Primary production | Customer workloads |
| `dr` | Disaster recovery | Standby for failover |
| `gpu` | GPU workloads | ML training |
| `dmz` | Public-facing | Edge services |

### Zone Services

| Service | Purpose | Why Zone-Specific |
|---------|---------|-------------------|
| **VyOS** | Firewall | Each zone has its own network boundary |
| **HAProxy** | Load balancer | Routes traffic into the zone |
| **K8s Masters** | Control plane | K8s cluster per zone |
| **K8s Workers** | Workloads | Where apps actually run |

### Zone Files

```
regions/eu/zones/main/
├── cluster.yaml           # Proxmox servers config
├── core-compute.yaml      # VyOS, HAProxy VMs
└── compute/
    └── apps.yaml          # K8s cluster, app VMs
```

### Zone VM Count

| Service | VMs per Zone (Production) |
|---------|---------------------------|
| VyOS | 2 |
| HAProxy (edge) | 2 |
| HAProxy (K8s) | 2 (if K8s) |
| K8s Masters | 3 (optional) |
| K8s Workers | 3+ (optional) |
| **Total (no K8s)** | **4** |
| **Total (with K8s)** | **12+** |

---

## Data Flow Example

```
User Request
    │
    ▼
┌─────────────────────────────────────────────────────┐
│ GLOBAL: PowerDNS resolves app.example.com           │
└─────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────┐
│ ZONE: HAProxy routes to K8s Ingress                 │
└─────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────┐
│ ZONE: K8s Worker serves the request                 │
│       App authenticates via GLOBAL Keycloak         │
│       App reads secrets from GLOBAL Vault           │
│       App uses GLOBAL PostgreSQL                    │
└─────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────┐
│ REGIONAL: Prometheus scrapes metrics                │
│ REGIONAL: Loki collects logs                        │
└─────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────┐
│ HUB: PBS backs up VM every 30min                    │
│ HUB: MinIO stores WAL archives                      │
└─────────────────────────────────────────────────────┘
```

---

## File Structure Summary

```
project/
├── platform.yaml              # GLOBAL config
├── orchestrator.yaml          # GLOBAL: Soverstack, PDM
├── security.yaml              # GLOBAL: Vault, Keycloak (Teleport is regional)
├── networking.yaml            # GLOBAL: Headscale, PowerDNS
├── observability.yaml         # GLOBAL: Grafana
├── core-compute.yaml          # GLOBAL: VMs
├── core-database.yaml         # GLOBAL: PostgreSQL
│
└── regions/
    └── eu/
        ├── region.yaml        # REGIONAL config
        ├── core-compute.yaml  # REGIONAL: Teleport, Prometheus, Loki, Wazuh
        │
        ├── hub/
        │   └── cluster.yaml   # HUB: PBS, MinIO
        │
        └── zones/
            └── main/
                ├── cluster.yaml       # ZONE: Proxmox servers
                ├── core-compute.yaml  # ZONE: VyOS, HAProxy
                └── compute/
                    └── apps.yaml      # ZONE: K8s, apps
```

---

## VM Count by Tier

| Scope | Local | Production | Enterprise |
|-------|-------|------------|------------|
| Global | 9 | 17 | 17 |
| Regional (×1) | 5 | 6 | 6 |
| Hub (×1) | 0 | 2 | 2 |
| Zone (×1, no K8s) | 2 | 4 | 4 |
| Zone (×1, with K8s) | - | 12 | 12 |
| **Total (1 region, 1 zone, no K8s)** | **16** | **29** | **29** |
| **Total (1 region, 1 zone, with K8s)** | **16** | **37** | **37** |

---

## Decision Guide

**Where should my service run?**

```
Is it needed BEFORE K8s exists?
├── YES → Global VM
│         (DNS, Auth, Secrets, Database)
│
└── NO → Does it store user data or need GDPR compliance?
         ├── YES → Regional VM
         │         (Teleport, Prometheus, Loki, Wazuh)
         │
         └── NO → Is it backup/archival?
                  ├── YES → Hub
                  │         (PBS, MinIO)
                  │
                  └── NO → Zone (K8s or VM)
                           (Apps, Workers)
```

---

## Multi-Region Example

```
project/
├── [GLOBAL files]
│
└── regions/
    ├── eu/
    │   ├── region.yaml
    │   ├── core-compute.yaml    # EU Teleport, Prometheus, Loki
    │   ├── hub/                 # EU backups
    │   └── zones/
    │       ├── main/            # EU production
    │       └── dr/              # EU disaster recovery
    │
    └── us/
        ├── region.yaml
        ├── core-compute.yaml    # US Teleport, Prometheus, Loki
        ├── hub/                 # US backups
        └── zones/
            └── main/            # US production
```

**VM Count (2 regions, 2 zones each, with K8s):**
- Global: 17
- Regional: 6 × 2 = 12
- Hub: 2 × 2 = 4
- Zone: 12 × 4 = 48
- **Total: ~81 VMs**
