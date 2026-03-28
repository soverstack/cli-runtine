# Soverstack Init V2

New project structure with clear separation between physical infrastructure (inventory) and logical services (workloads).

## Structure Generated

```
project/
├── soverstack.yaml              # Global config (images, flavors, defaults)
├── .env                         # Credentials (NEVER COMMIT)
│
├── inventory/                   # PHYSICAL INFRASTRUCTURE
│   ├── ssh.yaml                 # SSH configuration
│   └── {region}/
│       ├── region.yaml          # Region metadata
│       └── datacenters/
│           ├── hub-{region}/    # Backup storage (HDD)
│           │   ├── network.yaml # VLANs (10, 11, 40)
│           │   └── nodes.yaml   # Proxmox nodes
│           └── zone-{name}/     # Production compute (NVMe + Ceph)
│               ├── network.yaml # VLANs (10, 11, 20, 30, 31, 40) + public_ips
│               └── nodes.yaml
│
└── workloads/                   # LOGICAL SERVICES
    ├── global/                  # Unique worldwide
    │   ├── identity.yaml        # Vault, Keycloak
    │   ├── dns.yaml             # PowerDNS, dnsdist
    │   └── database.yaml        # PostgreSQL
    │
    ├── regional/                # One per region
    │   └── {region}/
    │       ├── observability.yaml  # Prometheus, Loki, Grafana
    │       └── security.yaml       # Teleport, Wazuh
    │
    └── zonal/                   # One per datacenter
        └── {region}/
            ├── hub-{region}/
            │   └── storage.yaml    # MinIO, PBS
            └── zone-{name}/
                └── edge.yaml       # VyOS, HAProxy
```

## Usage

```bash
# Interactive mode
soverstack init-v2 my-project

# Non-interactive mode
soverstack init-v2 my-project \
  --domain example.com \
  --tier production \
  --regions "eu:paris,lyon;us:oregon" \
  --non-interactive
```

## Options

| Option | Description | Default |
|--------|-------------|---------|
| `--domain` | Domain name | `example.com` |
| `--tier` | Infrastructure tier: `local`, `production`, `enterprise` | `production` |
| `--regions` | Regions and zones (format: `region:zone1,zone2;region2:zone`) | `eu:main` |
| `--non-interactive` | Skip prompts | `false` |

## Network Architecture

### VLANs

| VLAN | Name | Mesh | MTU | Zone | Hub | Usage |
|------|------|------|-----|------|-----|-------|
| 10 | management | Yes | 1500 | ✅ | ✅ | Proxmox API, SSH, Soverstack |
| 11 | corosync | No | 9000 | ✅ | ✅ | Proxmox cluster, HA, Quorum |
| 20 | vm-network | Yes | 1500 | ✅ | ❌ | VM traffic |
| 30 | ceph-public | No | 9000 | ✅ | ❌ | VM to Ceph |
| 31 | ceph-cluster | No | 9000 | ✅ | ❌ | OSD replication |
| 40 | backup | Yes | 1500 | ✅ | ✅ | Zone to Hub backup |

### Mesh vs Direct

- `mesh: true` → Traffic via Headscale/WireGuard (encrypted, cross-DC capable)
- `mesh: false` → Direct L2 (local performance, same switch)

### Public IPs

```yaml
# Only in zones (required for control plane, optional for others)
public_ips:
  type: allocated_block          # allocated_block | bgp
  allocated_block:
    block: "203.0.113.0/29"
    gateway: "203.0.113.1"
    usable_range: "203.0.113.2-203.0.113.6"
```

Soverstack automatically assigns IPs to services (firewall, dns, ingress, vpn).

### Subnet Scheme

| Region | Octet | Example |
|--------|-------|---------|
| eu | 1 | `10.1.x.0/24` |
| us | 2 | `10.2.x.0/24` |
| asia | 3 | `10.3.x.0/24` |

## Key Concepts

### Inventory vs Workloads

- **Inventory**: Physical infrastructure (servers, networks). Managed by infra team.
- **Workloads**: Logical services to deploy. Managed by DevOps team.

### Datacenter Types

| Type | Purpose | VLANs | Public IPs |
|------|---------|-------|------------|
| Zone (control plane) | Production + global services | All 6 | Required |
| Zone (other) | Production compute | All 6 | Optional |
| Hub | Backup storage | 3 (10, 11, 40) | None |

### Infrastructure Tiers

| Tier | Nodes | Hub | HA |
|------|-------|-----|-----|
| local | 1+ | No | Optional |
| production | 3+ | Yes | Enforced |
| enterprise | 5+ | Yes | Enforced + Backup |

### Images

Defined globally in `soverstack.yaml`:

```yaml
images:
  - name: debian-12
    url: https://cloud.debian.org/images/cloud/bookworm/latest/debian-12-generic-amd64.qcow2
    default: true

  - name: ubuntu-24
    url: https://cloud-images.ubuntu.com/noble/current/noble-server-cloudimg-amd64.img
```

Referenced in workloads:

```yaml
services:
  - name: vault-01
    flavor: standard
    image: debian-12
```

### Flavors

Defined globally in `soverstack.yaml`:

```yaml
flavors:
  - name: micro
    cpu: 1
    ram: 1024
    disk: 10G

  - name: standard
    cpu: 2
    ram: 4096
    disk: 32G
```

### Placement

Global services are deployed on the **control plane** datacenter:

```yaml
defaults:
  global_placement:
    region: eu
    datacenter: zone-paris
```

## Architecture

```
src/commands/init-v2/
├── index.ts          # Command entry point
├── logic.ts          # Main orchestrator (ProjectInitializer class)
├── types.ts          # Type definitions and helpers
├── README.md         # This file
└── generators/       # File generators
    ├── index.ts      # Export all generators
    ├── root/         # soverstack.yaml, .env, README, .gitignore
    ├── inventory/    # ssh.yaml, region.yaml, network.yaml, nodes.yaml
    └── workloads/
        ├── global/   # identity.yaml, dns.yaml, database.yaml
        ├── regional/ # observability.yaml, security.yaml
        └── zonal/    # edge.yaml, storage.yaml
```
