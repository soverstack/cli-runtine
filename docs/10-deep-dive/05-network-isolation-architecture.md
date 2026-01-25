---
id: network-isolation-architecture
title: Network Isolation Architecture
sidebar_position: 5
---

# Network Isolation Architecture

## Why Network Isolation?

Traditional datacenters use **physical VLANs** to isolate traffic. When your servers are spread across different providers (OVH, Hetzner, Scaleway), VLANs are impossible. Soverstack uses **WireGuard mesh networks** managed by Headscale to create **virtual VLANs** that work across any provider.

```
TRADITIONAL DATACENTER          SOVERSTACK (Multi-Provider)
────────────────────────        ────────────────────────────
Physical Switch                 Headscale (Control Plane)
├── VLAN 100: Management        ├── mesh-mgmt (10.10.0.0/24)
├── VLAN 200: Ceph Public       ├── mesh-ceph-pub (10.20.0.0/24)
├── VLAN 201: Ceph Cluster      ├── mesh-ceph-priv (10.21.0.0/24)
├── VLAN 300: Proxmox           ├── mesh-proxmox-pub (10.30.0.0/24)
└── VLAN 301: Proxmox Corosync  ├── mesh-proxmox-priv (10.31.0.0/24)
                                ├── mesh-backup (10.40.0.0/24)
                                └── mesh-public (10.50.0.0/24)
```

## Network Architecture Overview

```
                              INTERNET
                                 │
                    ┌────────────┼────────────┐
                    │            │            │
              ┌─────▼─────┐ ┌────▼────┐ ┌─────▼─────┐
              │  PVE-01   │ │ PVE-02  │ │  PVE-03   │
              │   OVH     │ │ Hetzner │ │ Scaleway  │
              │  Paris    │ │  Paris  │ │   Paris   │
              └─────┬─────┘ └────┬────┘ └─────┬─────┘
                    │            │            │
    ┌───────────────┼────────────┼────────────┼───────────────┐
    │               │            │            │               │
    │  ┌────────────┴────────────┴────────────┴────────────┐  │
    │  │              HEADSCALE (Control Plane)            │  │
    │  │         Coordinates peers, manages keys           │  │
    │  │            NO DATA TRAFFIC PASSES HERE            │  │
    │  └───────────────────────────────────────────────────┘  │
    │                                                         │
    │  MESH NETWORKS (Data Plane - Direct P2P)                │
    │  ════════════════════════════════════════                │
    │                                                         │
    │  ┌─────────────────┐  Traffic: Admin, SSH, Monitoring  │
    │  │ mesh-mgmt       │  Subnet:  10.10.0.0/24            │
    │  │ Port 51820      │  Nodes:   All                      │
    │  └─────────────────┘                                    │
    │                                                         │
    │  ┌─────────────────┐  Traffic: VM I/O to Ceph          │
    │  │ mesh-ceph-pub   │  Subnet:  10.20.0.0/24            │
    │  │ Port 51821      │  Nodes:   PVE + Ceph OSDs         │
    │  └─────────────────┘                                    │
    │                                                         │
    │  ┌─────────────────┐  Traffic: Ceph OSD replication    │
    │  │ mesh-ceph-priv  │  Subnet:  10.21.0.0/24            │
    │  │ Port 51822      │  Nodes:   Ceph OSDs only          │
    │  └─────────────────┘                                    │
    │                                                         │
    │  ┌─────────────────┐  Traffic: Proxmox API, Web UI     │
    │  │ mesh-pve-pub    │  Subnet:  10.30.0.0/24            │
    │  │ Port 51823      │  Nodes:   PVE nodes               │
    │  └─────────────────┘                                    │
    │                                                         │
    │  ┌─────────────────┐  Traffic: Corosync, Live Migration│
    │  │ mesh-pve-priv   │  Subnet:  10.31.0.0/24            │
    │  │ Port 51824      │  Nodes:   PVE nodes               │
    │  └─────────────────┘                                    │
    │                                                         │
    │  ┌─────────────────┐  Traffic: Backup to PBS/S3        │
    │  │ mesh-backup     │  Subnet:  10.40.0.0/24            │
    │  │ Port 51825      │  Nodes:   PVE + Backup servers    │
    │  └─────────────────┘                                    │
    │                                                         │
    │  ┌─────────────────┐  Traffic: Public services (VPN,   │
    │  │ mesh-services   │           Ingress, DNS)           │
    │  │ Port 51826      │  Subnet:  10.50.0.0/24            │
    │  └─────────────────┘  Nodes:   Service VMs             │
    │                                                         │
    └─────────────────────────────────────────────────────────┘
```

## Network Scopes: Global vs Zone

Soverstack separates mesh networks by **scope**:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           GLOBAL NETWORKS                                    │
│                    (networking.yaml - root level)                           │
│                                                                             │
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │  management (10.10.0.0/16)     ← SSH, monitoring, admin (all zones) │  │
│   │  backup (10.40.0.0/16)         ← Hub ↔ Zones backup traffic         │  │
│   └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│   WHY GLOBAL: Need to access any zone from anywhere                         │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                           ZONE NETWORKS                                      │
│                    (zones/{zone}/networking.yaml)                           │
│                                                                             │
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │  services (10.50.x.0/24)       ← VyOS, HAProxy, local services      │  │
│   │  ceph-public (10.20.x.0/24)    ← VM I/O to Ceph                     │  │
│   │  ceph-cluster (10.21.x.0/24)   ← Ceph replication (MTU 8940)        │  │
│   │  proxmox-public (10.30.x.0/24) ← Proxmox API/UI                     │  │
│   │  proxmox-cluster (10.31.x.0/24)← Corosync, live migration           │  │
│   └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│   WHY ZONE: Latency-critical, must stay local (<1ms)                        │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Why This Separation?

| Network | Scope | Why |
|---------|-------|-----|
| management | Global | Admin needs access to all zones from anywhere |
| backup | Global | Hub pulls backups from all zones |
| services | Zone | VyOS/HAProxy failover must be instant |
| ceph-public | Zone | VM I/O latency sensitive |
| ceph-cluster | Zone | Replication MUST be <1ms |
| proxmox-public | Zone | API calls stay local |
| proxmox-cluster | Zone | Corosync breaks at >2ms latency |

### Multi-Zone Example

```
┌───────────────────────────────────────────────────────────────────┐
│                         REGION: EU                                 │
├───────────────────────────────────────────────────────────────────┤
│                                                                   │
│  GLOBAL MESH (spans all zones)                                    │
│  ════════════════════════════                                     │
│  management: 10.10.0.0/16  ←──── Admin can reach zone-a & zone-b │
│  backup: 10.40.0.0/16      ←──── Hub pulls from both zones       │
│                                                                   │
│  ┌───────────────────────┐     ┌───────────────────────┐        │
│  │      ZONE: main       │     │     ZONE: dr          │        │
│  │     (Paris NVMe)      │     │   (Frankfurt NVMe)    │        │
│  │                       │     │                       │        │
│  │ services: 10.50.0.0/24│     │ services: 10.50.1.0/24│        │
│  │ ceph-pub: 10.20.0.0/24│     │ ceph-pub: 10.20.1.0/24│        │
│  │ ceph-priv:10.21.0.0/24│     │ ceph-priv:10.21.1.0/24│        │
│  │ pve-pub:  10.30.0.0/24│     │ pve-pub:  10.30.1.0/24│        │
│  │ pve-priv: 10.31.0.0/24│     │ pve-priv: 10.31.1.0/24│        │
│  └───────────────────────┘     └───────────────────────┘        │
│          │                              │                        │
│          └──────── NO CROSS-ZONE ───────┘                        │
│                   ROUTING FOR ZONE                               │
│                     MESH NETWORKS                                │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
```

**Key rule:** Zone mesh networks (ceph, proxmox, services) NEVER cross zone boundaries. Each zone has its own isolated instance of these networks.

---

## The 7 Isolated Networks

### 1. Management Network (mesh-mgmt)

**Purpose:** Administration, SSH, monitoring, Soverstack orchestration

```
Subnet:     10.10.0.0/24
Port:       51820
Encryption: WireGuard (AES-256)
Nodes:      ALL (PVE, VMs, backup servers)

Traffic:
├── SSH access
├── Prometheus scraping
├── Grafana queries
├── Soverstack CLI operations
└── Ansible/Terraform execution
```

**Why isolated:** If an application VM is compromised, attacker cannot access management interfaces of other nodes.

### 2. Ceph Public Network (mesh-ceph-pub)

**Purpose:** Client I/O from VMs to Ceph OSDs

```
Subnet:     10.20.0.0/24
Port:       51821
Encryption: WireGuard (AES-256)
Nodes:      PVE hypervisors + Ceph OSD nodes

Traffic:
├── VM disk reads/writes
├── QEMU/KVM to Ceph OSD
└── RBD block device I/O
```

**Why isolated:** Storage traffic is high-bandwidth. Isolation prevents saturation of other networks.

### 3. Ceph Cluster Network (mesh-ceph-priv)

**Purpose:** Ceph internal replication between OSDs

```
Subnet:     10.21.0.0/24
Port:       51822
Encryption: WireGuard (AES-256)
Nodes:      Ceph OSD nodes ONLY

Traffic:
├── OSD-to-OSD replication
├── Recovery traffic
├── Rebalancing
└── Heartbeats
```

**Why isolated:** Replication traffic can be 2-3x client traffic during recovery. Must not impact client I/O.

### 4. Proxmox Public Network (mesh-pve-pub)

**Purpose:** Proxmox API, Web UI, external access to cluster

```
Subnet:     10.30.0.0/24
Port:       51823
Encryption: WireGuard (AES-256)
Nodes:      PVE hypervisors

Traffic:
├── Proxmox Web UI (port 8006)
├── Proxmox API
├── pvesh commands
└── Terraform Proxmox provider
```

**Why isolated:** Management plane should be separate from data plane.

### 5. Proxmox Cluster Network (mesh-pve-priv)

**Purpose:** Corosync cluster communication, live migration

```
Subnet:     10.31.0.0/24
Port:       51824
Encryption: WireGuard (AES-256)
Nodes:      PVE hypervisors ONLY

Traffic:
├── Corosync heartbeats (critical!)
├── Cluster quorum
├── Live migration memory transfer
├── HA fencing
└── pmxcfs (cluster filesystem)
```

**Why isolated:** Corosync is extremely latency-sensitive. Any disruption = cluster instability.

### 6. Backup Network (mesh-backup)

**Purpose:** Backup traffic to PBS (Proxmox Backup Server) or S3

```
Subnet:     10.40.0.0/24
Port:       51825
Encryption: WireGuard (AES-256)
Nodes:      PVE hypervisors + Backup servers

Traffic:
├── Proxmox Backup Server
├── Restic to S3
├── pg_dump transfers
└── Snapshot uploads
```

**Why isolated:** Backup traffic can saturate network. Running backups should not impact production.

### 7. Services Network (mesh-services)

**Purpose:** Inter-service communication for public-facing services

```
Subnet:     10.50.0.0/24
Port:       51826
Encryption: WireGuard (AES-256)
Nodes:      Service VMs (Firewall, VPN, Ingress, DNS)

Traffic:
├── Firewall ↔ VPN coordination
├── Ingress ↔ DNS
├── HAProxy ↔ backends
└── VRRP failover
```

**Why isolated:** Public-facing services are higher risk. Isolation limits blast radius.

## Performance: NVMe Compensates WireGuard Overhead

### The Math

```
TRADITIONAL (VLAN + SSD):
SSD latency:        0.5ms
Network (VLAN):     0.05ms
Total:              0.55ms

SOVERSTACK (WireGuard + NVMe):
NVMe latency:       0.1ms
Network (WG):       0.15ms
Total:              0.25ms

→ NVMe + WireGuard is FASTER than SSD + VLAN
```

### Benchmark Comparison

```
┌──────────────────────┬───────────────┬───────────────┬───────────────┐
│      Workload        │  VLAN + SSD   │  VLAN + NVMe  │   WG + NVMe   │
├──────────────────────┼───────────────┼───────────────┼───────────────┤
│ 4K Random Read IOPS  │    50,000     │   100,000     │    90,000     │
│ 4K Random Write IOPS │    30,000     │    80,000     │    72,000     │
│ Seq Read (MB/s)      │      550      │    3,200      │    2,900      │
│ Seq Write (MB/s)     │      450      │    2,800      │    2,500      │
│ Avg Latency          │    0.55ms     │    0.15ms     │    0.25ms     │
└──────────────────────┴───────────────┴───────────────┴───────────────┘

Conclusion: WireGuard + NVMe beats VLAN + SSD by 50-80%
```

### Multi-City Latency with NVMe

```
SAME CITY (Paris ↔ Paris):
Base latency:       0.5ms
+ WireGuard:        0.15ms
+ NVMe overhead:    0.1ms
Total:              0.75ms  ✅ Excellent for Ceph

NEARBY CITIES (Paris ↔ Frankfurt, ~500km):
Base latency:       8ms
+ WireGuard:        0.15ms
+ NVMe overhead:    0.1ms
Total:              8.25ms  ⚠️ OK for async replication, not Ceph

FAR CITIES (Paris ↔ Helsinki, ~2000km):
Base latency:       30ms
+ WireGuard:        0.15ms
+ NVMe overhead:    0.1ms
Total:              30.25ms ❌ Backup/DR only
```

**Key insight:** With NVMe, the WireGuard overhead (0.15ms) becomes negligible. The dominant factor is physical distance.

## Critical: MTU Configuration

### Why MTU Matters

WireGuard adds overhead to each packet. If MTU is wrong, packets get fragmented = **massive performance loss**.

```
WIREGUARD OVERHEAD:
├── WireGuard header:  32 bytes
├── UDP header:         8 bytes
├── IPv4 header:       20 bytes
└── Total overhead:    60 bytes (IPv4)
                       80 bytes (IPv6)
```

### MTU Calculation

```
STANDARD ETHERNET (MTU 1500):
┌─────────────────────────────────────────────────────────────┐
│  Ethernet MTU:           1500 bytes                         │
│  - WireGuard overhead:   - 60 bytes                         │
│  = WireGuard MTU:        1440 bytes (IPv4)                  │
│                          1420 bytes (IPv6)                  │
└─────────────────────────────────────────────────────────────┘

JUMBO FRAMES (MTU 9000) - If provider supports:
┌─────────────────────────────────────────────────────────────┐
│  Ethernet MTU:           9000 bytes                         │
│  - WireGuard overhead:   - 60 bytes                         │
│  = WireGuard MTU:        8940 bytes                         │
│                                                             │
│  → 6x larger packets = much better throughput!              │
└─────────────────────────────────────────────────────────────┘
```

### MTU Configuration per Network

```yaml
# networking.yaml

mesh_networks:
  - name: management
    subnet: "10.10.0.0/24"
    mtu: 1420              # Standard - safe default

  - name: ceph-public
    subnet: "10.20.0.0/24"
    mtu: 1400              # Slightly lower for Ceph encapsulation

  - name: ceph-cluster
    subnet: "10.21.0.0/24"
    mtu: 8940              # Jumbo frames if supported!
    # Ceph replication = large sequential transfers
    # Jumbo frames = huge performance gain

  - name: proxmox-cluster
    subnet: "10.31.0.0/24"
    mtu: 1420              # Standard for Corosync

  - name: backup
    subnet: "10.40.0.0/24"
    mtu: 8940              # Jumbo frames for backup transfers
```

### How to Check Provider MTU Support

```bash
# Test MTU to peer (replace with actual IP)
ping -M do -s 8000 10.20.0.2

# If it works: jumbo frames supported
# If "message too long": use standard MTU 1420

# Check current interface MTU
ip link show eth0 | grep mtu
```

### Impact of Wrong MTU

```
CORRECT MTU (1420):
├── Packets flow without fragmentation
├── Full throughput achieved
└── Latency: minimal

WRONG MTU (1500 on WireGuard):
├── Every packet fragmented
├── Throughput: -30 to -50%
├── Latency: +100-200%
├── CPU: +50% (reassembly)
└── Ceph: SEVERE performance degradation
```

## Critical: Kernel WireGuard vs Userspace

### Why Kernel WireGuard is ESSENTIAL with NVMe

NVMe generates **many more IOPS** than SSD. Each IOP = network packets. More packets = more WireGuard processing.

```
SSD (50,000 IOPS):
├── 50,000 I/O operations/sec
├── ~100,000 packets/sec (read + ack)
└── Userspace WireGuard: manageable

NVMe (500,000 IOPS):
├── 500,000 I/O operations/sec
├── ~1,000,000 packets/sec
└── Userspace WireGuard: CPU BOTTLENECK!
```

### Performance Comparison

```
┌─────────────────────┬─────────────────┬─────────────────┐
│      Metric         │   Userspace WG  │   Kernel WG     │
├─────────────────────┼─────────────────┼─────────────────┤
│ Latency per packet  │   100-200μs     │   20-50μs       │
│ Max throughput      │   2-3 Gbps      │   10+ Gbps      │
│ Max packets/sec     │   ~200,000      │   ~2,000,000    │
│ CPU per 10Gbps      │   400-600%      │   50-100%       │
│ Context switches    │   2 per packet  │   0             │
└─────────────────────┴─────────────────┴─────────────────┘

With NVMe:
├── Userspace: NVMe bottlenecked by WireGuard CPU
├── Kernel:    Full NVMe performance achieved
└── Difference: 3-5x throughput!
```

### How to Verify Kernel WireGuard

```bash
# Check if kernel module is loaded
lsmod | grep wireguard

# Expected output:
# wireguard   90112  0

# If empty, load the module:
modprobe wireguard

# Verify it's being used (not userspace)
wg show
# Should show interface without "[userspace]" tag
```

### Installing Kernel WireGuard on Proxmox

```bash
# Proxmox 8.x (Debian 12 based)
apt update
apt install -y wireguard-tools

# The kernel module is included in Proxmox kernel
# Just need the tools

# For custom kernels, also install:
apt install -y wireguard-dkms

# Verify after reboot
lsmod | grep wireguard
```

### Enable Hardware Offloading

```bash
# Enable UDP offloading for WireGuard performance
# Run on each node, for the physical interface

ethtool -K eth0 rx-udp-gro-forwarding on
ethtool -K eth0 rx-gro-list off

# Make persistent in /etc/network/interfaces:
# post-up ethtool -K eth0 rx-udp-gro-forwarding on
# post-up ethtool -K eth0 rx-gro-list off
```

## Ceph Migration Between Regions

### The Challenge

```
CEPH SAME REGION (Paris ↔ Paris):
Latency: 0.5ms
├── Synchronous replication: ✅ Works great
├── Recovery: Fast (high bandwidth)
└── Performance: Excellent

CEPH CROSS-REGION (Paris ↔ Frankfurt):
Latency: 8-15ms
├── Synchronous replication: ⚠️ Very slow
├── Every write waits for remote ACK
├── IOPS drops 10-50x
└── NOT RECOMMENDED for production
```

### Migration Strategy: NOT Stretched Cluster

**DO NOT** create a "stretched" Ceph cluster across regions. Instead:

```
WRONG: Stretched Cluster
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  Paris (OVH)              Frankfurt (Hetzner)               │
│  ┌─────────┐              ┌─────────┐                      │
│  │ OSD.1   │◄────8ms────►│ OSD.4   │                      │
│  │ OSD.2   │◄────8ms────►│ OSD.5   │                      │
│  │ OSD.3   │◄────8ms────►│ OSD.6   │                      │
│  └─────────┘              └─────────┘                      │
│                                                             │
│  Every write: Paris → Frankfurt → ACK                       │
│  Latency: +16ms minimum per write                          │
│  IOPS: Destroyed                                            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
❌ NEVER DO THIS


RIGHT: Separate Clusters + Async Replication
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  Paris (Primary)          Frankfurt (DR)                    │
│  ┌─────────────┐          ┌─────────────┐                  │
│  │ Ceph Pool A │          │ Ceph Pool B │                  │
│  │ OSD.1,2,3   │───async──►│ OSD.4,5,6   │                  │
│  │ Full speed  │  (rbd-   │ Replica     │                  │
│  │ 0.5ms       │  mirror) │ DR only     │                  │
│  └─────────────┘          └─────────────┘                  │
│                                                             │
│  Writes: Local only (fast)                                  │
│  Replication: Background async (doesn't block)              │
│  Failover: Manual or automated                              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
✅ CORRECT APPROACH
```

### Provider Migration (Same Region)

When migrating between providers in the **same region**:

```
STEP-BY-STEP MIGRATION (Paris OVH → Paris Hetzner)

1. INITIAL STATE
   ┌─────────────────────┐
   │ OVH Paris           │
   │ pve-01 (OSD.0,1)   │
   │ pve-02 (OSD.2,3)   │
   │ pve-03 (OSD.4,5)   │
   │ 6 OSDs, 3TB usable │
   └─────────────────────┘

2. ADD HETZNER NODES TO MESH
   ┌─────────────────────┬─────────────────────┐
   │ OVH Paris           │ Hetzner Paris       │
   │ pve-01,02,03        │ pve-04,05,06        │
   │ Mesh connected (0.5ms latency)            │
   └─────────────────────┴─────────────────────┘

3. ADD HETZNER OSDs TO CEPH
   ceph osd create (on pve-04, 05, 06)

   ┌───────────────────────────────────────────┐
   │ Ceph now has 12 OSDs                      │
   │ OVH: OSD.0-5 | Hetzner: OSD.6-11         │
   │ Rebalancing starts automatically          │
   └───────────────────────────────────────────┘

4. WAIT FOR REBALANCING
   ceph -s
   # Watch for "active+clean" state
   # Data is copying: OVH → Hetzner over mesh

   Time estimate:
   ├── 1TB data, 1Gbps link: ~3 hours
   ├── 1TB data, 10Gbps link: ~20 minutes
   └── Runs in background, no downtime

5. SET CRUSH RULES TO PREFER HETZNER
   # Tell Ceph to move primaries to Hetzner
   ceph osd crush rule create-replicated hetzner-primary ...

   # Or mark OVH OSDs as "out" gradually
   ceph osd out osd.0
   ceph osd out osd.1
   # ... wait for rebalancing between each

6. REMOVE OVH OSDs
   ceph osd out osd.0
   ceph osd crush remove osd.0
   ceph osd rm osd.0
   # Repeat for all OVH OSDs

   ┌───────────────────────────────────────────┐
   │ Ceph now has 6 OSDs (Hetzner only)        │
   │ All data migrated                         │
   └───────────────────────────────────────────┘

7. REMOVE OVH NODES FROM MESH
   # Disconnect pve-01, 02, 03
   # Cancel OVH servers

   ┌─────────────────────┐
   │ Hetzner Paris       │
   │ pve-04,05,06        │
   │ Migration complete! │
   └─────────────────────┘
```

### Migration Time Estimates

```
DATA SIZE    LINK SPEED    ESTIMATED TIME
─────────────────────────────────────────
100 GB       1 Gbps        ~15 minutes
100 GB       10 Gbps       ~2 minutes
1 TB         1 Gbps        ~2.5 hours
1 TB         10 Gbps       ~15 minutes
10 TB        1 Gbps        ~24 hours
10 TB        10 Gbps       ~2.5 hours

Note: These are transfer times. Ceph rebalancing
adds overhead, multiply by ~1.5x for total time.
```

### Cross-Region Disaster Recovery

For DR (not migration), use `rbd-mirror`:

```bash
# On Paris cluster (primary)
rbd mirror pool enable pool-name image

# On Frankfurt cluster (secondary)
rbd mirror pool peer add pool-name client.admin@paris

# Status
rbd mirror pool status pool-name

# Replication is async - no performance impact
# RPO: seconds to minutes depending on write rate
```

## Node Configuration

### What each PVE node looks like

```
┌─────────────────────────────────────────────────────────────────┐
│                         PVE-01                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Physical Interface: eth0 (Public IP: 51.210.x.x)              │
│                                                                 │
│  WireGuard Interfaces:                                          │
│  ├── wg-mgmt       10.10.0.1/24   (Management)                 │
│  ├── wg-ceph-pub   10.20.0.1/24   (Ceph Public)                │
│  ├── wg-ceph-priv  10.21.0.1/24   (Ceph Cluster)               │
│  ├── wg-pve-pub    10.30.0.1/24   (Proxmox Public)             │
│  ├── wg-pve-priv   10.31.0.1/24   (Proxmox Cluster)            │
│  ├── wg-backup     10.40.0.1/24   (Backup)                     │
│  └── wg-services   10.50.0.1/24   (Services)                   │
│                                                                 │
│  Ceph Configuration:                                            │
│  ├── public_network:  10.20.0.0/24                             │
│  └── cluster_network: 10.21.0.0/24                             │
│                                                                 │
│  Proxmox Cluster:                                               │
│  ├── pvecm link0: 10.31.0.1 (Corosync)                         │
│  └── migration_network: 10.31.0.0/24                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### IP Addressing Scheme

```
Network          PVE-01      PVE-02      PVE-03      Backup-01
─────────────────────────────────────────────────────────────────
mesh-mgmt        10.10.0.1   10.10.0.2   10.10.0.3   10.10.0.100
mesh-ceph-pub    10.20.0.1   10.20.0.2   10.20.0.3   -
mesh-ceph-priv   10.21.0.1   10.21.0.2   10.21.0.3   -
mesh-pve-pub     10.30.0.1   10.30.0.2   10.30.0.3   -
mesh-pve-priv    10.31.0.1   10.31.0.2   10.31.0.3   -
mesh-backup      10.40.0.1   10.40.0.2   10.40.0.3   10.40.0.100
mesh-services    10.50.0.1   10.50.0.2   10.50.0.3   -
```

## Headscale Configuration

### Single Headscale + ACL Tags vs Multiple Instances

There are three approaches to network isolation with Headscale:

#### Option A: Single Headscale + ACL Tags (Simplest)

```
┌─────────────────────────────────────────────────────────────┐
│                    ONE HEADSCALE INSTANCE                    │
│                                                             │
│  All nodes on SAME network: 100.64.0.0/10                  │
│                                                             │
│  PVE-01: 100.64.0.1  [tag:pve, tag:ceph]                   │
│  PVE-02: 100.64.0.2  [tag:pve, tag:ceph]                   │
│  Backup: 100.64.0.10 [tag:backup]                          │
│  App-VM: 100.64.0.20 [tag:app]                             │
│                                                             │
│  ACL Policy controls who talks to whom                      │
└─────────────────────────────────────────────────────────────┘
```

**ACL Policy example:**
```json
{
  "acls": [
    {"action": "accept", "src": ["tag:ceph"], "dst": ["tag:ceph:6789,6800-7300"]},
    {"action": "accept", "src": ["tag:pve"], "dst": ["tag:pve:8006,5405-5412"]},
    {"action": "accept", "src": ["tag:backup"], "dst": ["tag:pve:8007"]},
    {"action": "accept", "src": ["tag:app"], "dst": ["tag:app:*"]}
  ]
}
```

**Characteristics:**
- ✅ Simplest to manage
- ✅ Lowest resource usage (~2GB RAM)
- ⚠️ Logical isolation only (ACL-based firewall rules)
- ⚠️ All nodes on same IP space (can ping each other if ACL misconfigured)
- ⚠️ Compromised node could potentially bypass ACLs

#### Option B: Multiple Headscale Containers (Recommended)

```
┌─────────────────────────────────────────────────────────────┐
│              VM "headscale-server" (4GB RAM)                │
│                                                             │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐          │
│  │  Container  │ │  Container  │ │  Container  │          │
│  │  hs-mgmt    │ │  hs-ceph    │ │  hs-pve     │          │
│  │  :8080      │ │  :8081      │ │  :8082      │          │
│  │  :51820     │ │  :51821     │ │  :51823     │          │
│  │             │ │             │ │             │          │
│  │ 10.10.0.0/24│ │ 10.20.0.0/24│ │ 10.30.0.0/24│          │
│  └─────────────┘ └─────────────┘ └─────────────┘          │
│                                                             │
│  ┌─────────────┐ ┌─────────────┐                          │
│  │  Container  │ │  Container  │                          │
│  │  hs-backup  │ │ hs-services │                          │
│  │  :8083      │ │  :8084      │                          │
│  │  :51825     │ │  :51826     │                          │
│  │             │ │             │                          │
│  │ 10.40.0.0/24│ │ 10.50.0.0/24│                          │
│  └─────────────┘ └─────────────┘                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘

Each container = separate mesh = separate IP space
Networks CANNOT route to each other (true isolation)
```

**Characteristics:**
- ✅ True network isolation (different subnets)
- ✅ Reasonable resource usage (~4GB RAM for 5 instances)
- ✅ Easy management (single docker-compose)
- ✅ If one mesh compromised, others are isolated
- ⚠️ If VM compromised, all control planes compromised
  - But: P2P traffic remains E2E encrypted (WireGuard)
  - Attacker gets control plane, not data plane

#### Option C: Multiple VMs (Maximum Isolation)

```
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│ VM hs-mgmt  │  │ VM hs-ceph  │  │ VM hs-pve   │
│ Headscale   │  │ Headscale   │  │ Headscale   │
│ 2GB RAM     │  │ 2GB RAM     │  │ 2GB RAM     │
└─────────────┘  └─────────────┘  └─────────────┘

5 VMs × 2GB = 10GB RAM for control plane only
```

**Characteristics:**
- ✅ Maximum isolation
- ❌ High resource overhead
- ❌ Complex to manage
- ⚠️ Overkill for most use cases

### Comparison Table

```
┌─────────────────────┬─────────────────┬─────────────────┬─────────────────┐
│                     │ Single + Tags   │ Multi Container │ Multi VM        │
├─────────────────────┼─────────────────┼─────────────────┼─────────────────┤
│ Isolation type      │ Logical (ACL)   │ Network (L3)    │ Network + VM    │
│ Security level      │ Medium          │ High            │ Maximum         │
│ Resource usage      │ ~2GB            │ ~4GB            │ ~10GB           │
│ Complexity          │ Low             │ Medium          │ High            │
│ Management          │ 1 config        │ 1 compose file  │ 5+ VMs          │
│ Blast radius        │ All networks    │ 1 network       │ 1 network       │
│ Performance         │ Same            │ Same            │ Same            │
├─────────────────────┼─────────────────┼─────────────────┼─────────────────┤
│ Recommended for     │ Dev, small prod │ Production      │ High compliance │
└─────────────────────┴─────────────────┴─────────────────┴─────────────────┘
```

### Soverstack Recommendation: Option B (Multiple Containers)

```
WHY OPTION B?

1. True network isolation
   ├── Each mesh = different subnet
   ├── No routing between meshes
   └── Compromised network ≠ access to others

2. Practical resource usage
   ├── One VM, multiple containers
   ├── ~4GB RAM total
   └── Containers are lightweight (~200MB each)

3. Simple management
   ├── Single docker-compose.yml
   ├── Easy to backup/restore
   └── Easy to add/remove networks

4. Security is sufficient
   ├── Control plane compromise ≠ data compromise
   ├── WireGuard P2P traffic stays encrypted
   └── Attacker can't decrypt existing tunnels
```

### Multiple Headscale Instances Setup

For true isolation, run separate Headscale instances per network in one VM:

```yaml
# docker-compose.yml on headscale VM

version: "3.8"

services:
  # Management network (SSH, monitoring, admin)
  hs-mgmt:
    image: headscale/headscale:latest
    container_name: hs-mgmt
    restart: unless-stopped
    ports:
      - "8080:8080"    # Admin API
      - "51820:51820/udp"  # WireGuard
    volumes:
      - ./config-mgmt:/etc/headscale
      - ./data-mgmt:/var/lib/headscale
    command: serve

  # Ceph network (storage traffic)
  hs-ceph:
    image: headscale/headscale:latest
    container_name: hs-ceph
    restart: unless-stopped
    ports:
      - "8081:8080"
      - "51821:51820/udp"
    volumes:
      - ./config-ceph:/etc/headscale
      - ./data-ceph:/var/lib/headscale
    command: serve

  # Proxmox network (cluster communication)
  hs-pve:
    image: headscale/headscale:latest
    container_name: hs-pve
    restart: unless-stopped
    ports:
      - "8082:8080"
      - "51823:51820/udp"
    volumes:
      - ./config-pve:/etc/headscale
      - ./data-pve:/var/lib/headscale
    command: serve

  # Backup network
  hs-backup:
    image: headscale/headscale:latest
    container_name: hs-backup
    restart: unless-stopped
    ports:
      - "8083:8080"
      - "51825:51820/udp"
    volumes:
      - ./config-backup:/etc/headscale
      - ./data-backup:/var/lib/headscale
    command: serve

  # Services network (public-facing)
  hs-services:
    image: headscale/headscale:latest
    container_name: hs-services
    restart: unless-stopped
    ports:
      - "8084:8080"
      - "51826:51820/udp"
    volumes:
      - ./config-services:/etc/headscale
      - ./data-services:/var/lib/headscale
    command: serve
```

### Configuration per Instance

Each Headscale instance needs its own config:

```yaml
# config-mgmt/config.yaml
server_url: https://hs-mgmt.example.com
listen_addr: 0.0.0.0:8080
metrics_listen_addr: 0.0.0.0:9090
private_key_path: /var/lib/headscale/private.key
noise:
  private_key_path: /var/lib/headscale/noise_private.key
prefixes:
  v4: 10.10.0.0/24    # Management subnet
  v6: fd7a:115c:a1e0::/48
db_type: sqlite3
db_path: /var/lib/headscale/db.sqlite

# config-ceph/config.yaml
server_url: https://hs-ceph.example.com
prefixes:
  v4: 10.20.0.0/24    # Ceph subnet
# ... rest same

# config-pve/config.yaml
prefixes:
  v4: 10.30.0.0/24    # Proxmox subnet

# config-backup/config.yaml
prefixes:
  v4: 10.40.0.0/24    # Backup subnet

# config-services/config.yaml
prefixes:
  v4: 10.50.0.0/24    # Services subnet
```

### Node Registration

Each PVE node registers to multiple Headscale instances:

```bash
# On PVE-01: Register to each network

# Management network
tailscale up --login-server=https://hs-mgmt.example.com:8080 \
  --hostname=pve-01-mgmt \
  --accept-routes

# Ceph network (separate tailscale instance or use --socket)
tailscale --socket=/var/run/tailscale-ceph.sock up \
  --login-server=https://hs-ceph.example.com:8081 \
  --hostname=pve-01-ceph

# Proxmox network
tailscale --socket=/var/run/tailscale-pve.sock up \
  --login-server=https://hs-pve.example.com:8082 \
  --hostname=pve-01-pve

# etc.
```

Result on PVE-01:
```
$ ip addr
...
tailscale0: 10.10.0.1/24   # Management
tailscale1: 10.20.0.1/24   # Ceph
tailscale2: 10.30.0.1/24   # Proxmox
tailscale3: 10.40.0.1/24   # Backup
```

### Why P2P is Better Than Hub-and-Spoke

```
HUB-AND-SPOKE (Traditional WireGuard):

   PVE-01 ──────► WG Server ◄────── PVE-02
                     │
                     ▼
                BOTTLENECK

   Latency: PVE-01 → Server → PVE-02 = 2x
   Bandwidth: Limited by server


MESH P2P (Headscale):

   ┌──────────────────────────────────────┐
   │      Headscale (Control Plane)       │
   │   Only handles: auth, key exchange   │
   │      NO DATA TRAFFIC                 │
   └──────────────────────────────────────┘
                     │
            Initial coordination
                     │
   PVE-01 ◄═══════════════════════════► PVE-02
              DIRECT CONNECTION

   Latency: PVE-01 → PVE-02 = 1x (minimum)
   Bandwidth: Wire speed between peers
```

## Firewall Rules (iptables/nftables)

Each node should restrict traffic per interface:

```bash
# Only allow SSH on management network
iptables -A INPUT -i wg-mgmt -p tcp --dport 22 -j ACCEPT
iptables -A INPUT -p tcp --dport 22 -j DROP

# Only allow Ceph on ceph networks
iptables -A INPUT -i wg-ceph-pub -p tcp --dport 6789 -j ACCEPT   # MON
iptables -A INPUT -i wg-ceph-pub -p tcp --dport 6800:7300 -j ACCEPT  # OSD
iptables -A INPUT -i wg-ceph-priv -p tcp --dport 6800:7300 -j ACCEPT

# Only allow Proxmox on pve networks
iptables -A INPUT -i wg-pve-pub -p tcp --dport 8006 -j ACCEPT   # Web UI
iptables -A INPUT -i wg-pve-priv -p udp --dport 5405:5412 -j ACCEPT  # Corosync

# Block everything else
iptables -A INPUT -j DROP
```

## Storage Requirements

### NVMe for Ceph (Required)

```yaml
# Minimum requirements per node

storage:
  ceph:
    type: nvme           # REQUIRED - SSD not recommended
    min_disks: 2         # Minimum 2 for redundancy
    min_size_gb: 512     # Per disk

    # Why NVMe?
    # 1. Compensates WireGuard overhead
    # 2. NVMe + WireGuard > SSD + VLAN
    # 3. Modern standard, similar price to SSD
```

### SSD for Backup/S3 (Sufficient)

```yaml
storage:
  backup:
    type: ssd            # SSD sufficient for S3/backup
    min_disks: 2
    min_size_gb: 2000    # Larger capacity, cheaper

    # Why SSD is enough?
    # 1. Backup = sequential I/O (not random)
    # 2. Not latency-critical
    # 3. Cost effective for large capacity
```

## Migration Scenario

One of the key benefits: **migrate between providers without downtime**.

```
DAY 1: All on OVH
┌─────────────────────────────────────────┐
│  OVH Paris                              │
│  ├── pve-01 (10.10.0.1)                │
│  ├── pve-02 (10.10.0.2)                │
│  └── pve-03 (10.10.0.3)                │
└─────────────────────────────────────────┘

DAY 30: OVH prices increase, want to move to Hetzner

DAY 31: Add Hetzner nodes to mesh
┌─────────────────────────────────────────┐
│  OVH Paris          Hetzner Paris       │
│  ├── pve-01 ◄──────► pve-04            │
│  ├── pve-02 ◄──────► pve-05            │
│  └── pve-03 ◄──────► pve-06            │
│                                         │
│  All nodes on same mesh networks        │
│  Ceph sees 6 OSDs now                   │
└─────────────────────────────────────────┘

DAY 32-40: Gradual migration
├── Extend Ceph to pve-04, 05, 06
├── Live migrate VMs to Hetzner nodes
├── Move Ceph primary to Hetzner
└── VMs keep their mesh IPs (10.x.x.x)!

DAY 41: Remove OVH
┌─────────────────────────────────────────┐
│  Hetzner Paris                          │
│  ├── pve-04 (10.10.0.4)                │
│  ├── pve-05 (10.10.0.5)                │
│  └── pve-06 (10.10.0.6)                │
└─────────────────────────────────────────┘

WHAT CHANGED:
├── Provider: OVH → Hetzner
├── Public IPs: Changed
└── Mesh IPs: UNCHANGED (services still work!)
```

## Summary

### Global Networks (networking.yaml)

| Network | Subnet | Purpose | Nodes | Config File |
|---------|--------|---------|-------|-------------|
| management | 10.10.0.0/16 | SSH, monitoring, admin | All | networking.yaml |
| backup | 10.40.0.0/16 | Hub ↔ Zones backup | PVE + Hub | networking.yaml |

### Zone Networks (zones/{zone}/networking.yaml)

| Network | Subnet | Purpose | Nodes | MTU |
|---------|--------|---------|-------|-----|
| services | 10.50.x.0/24 | VyOS, HAProxy, local | Service VMs | 1420 |
| ceph-public | 10.20.x.0/24 | VM I/O to Ceph | PVE + OSD | 1420 |
| ceph-cluster | 10.21.x.0/24 | Ceph replication | OSD only | 8940 |
| proxmox-public | 10.30.x.0/24 | Proxmox API/UI | PVE | 1420 |
| proxmox-cluster | 10.31.x.0/24 | Corosync, migration | PVE | 1420 |

*Note: `x` in subnet = zone index (0 for main, 1 for dr, etc.)*

**Key principles:**
1. **Scope separation:** Global networks cross zones, zone networks stay local
2. **Isolation:** Each network type has its own WireGuard mesh
3. **Performance:** NVMe requirement compensates WireGuard overhead
4. **Latency:** Zone networks for latency-critical traffic (<1ms)
5. **Freedom:** Provider-agnostic, migrate anytime
6. **Security:** Encryption everywhere, no plain-text traffic
