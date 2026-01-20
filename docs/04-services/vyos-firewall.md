# VyOS Firewall

VyOS provides edge security, routing, and network address translation.

## Overview

Soverstack deploys VyOS in an active-passive HA pair using VRRP.

```
┌─────────────────────────────────────────────────────────┐
│                     Internet                             │
└────────────────────────┬────────────────────────────────┘
                         │
              ┌──────────▼──────────┐
              │   Floating IP       │
              │   (VRRP VIP)        │
              └──────────┬──────────┘
                         │
         ┌───────────────┼───────────────┐
         │               │               │
   ┌─────▼─────┐               ┌─────▼─────┐
   │  VyOS-01  │◄─── VRRP ────►│  VyOS-02  │
   │  (Master) │               │  (Backup) │
   └─────┬─────┘               └─────┬─────┘
         │                           │
         └───────────┬───────────────┘
                     │
              ┌──────▼──────┐
              │  Internal   │
              │  Network    │
              └─────────────┘
```

## Configuration

Defined in [`networking.yaml`](../03-layers/networking.md) under `firewall`:

```yaml
firewall:
  enabled: true
  type: vyos
  vm_ids: [1, 2]
  public_ip:
    ip: "203.0.113.1"
    vrrp_id: 10
  internal_interface: eth1
  external_interface: eth0
```

## VM Specifications

| Tier | vCPU | RAM | Disk | Count |
|------|------|-----|------|-------|
| local | 2 | 2 GB | 20 GB | 1 |
| production | 4 | 4 GB | 20 GB | 2 |
| enterprise | 4 | 4 GB | 20 GB | 2 |

## Features

### Zone-Based Firewall

```
┌─────────────────────────────────────────────────────┐
│                     Zones                            │
│                                                      │
│  ┌─────────┐    ┌─────────┐    ┌─────────────────┐  │
│  │  WAN    │    │  LAN    │    │    SERVICES     │  │
│  │ (eth0)  │◄──►│ (eth1)  │◄──►│    (eth2)       │  │
│  └─────────┘    └─────────┘    └─────────────────┘  │
│                                                      │
│  Zone Policies:                                      │
│  - WAN → LAN: Stateful inspection                   │
│  - LAN → WAN: Allow outbound                        │
│  - LAN → SERVICES: Allow specific ports             │
└─────────────────────────────────────────────────────┘
```

### NAT Configuration

| Type | Description | Example |
|------|-------------|---------|
| SNAT | Outbound masquerade | LAN → Internet |
| DNAT | Port forwarding | Internet → Services |
| 1:1 NAT | Full IP mapping | Public ↔ Private |

### Default Firewall Rules

```
# Inbound (WAN → LAN)
- Allow established/related
- Allow ICMP (ping)
- Allow SSH to bastion (port 22)
- Allow HTTPS (port 443)
- Allow DNS (port 53)
- Drop all other

# Outbound (LAN → WAN)
- Allow all
```

## VRRP Configuration

High availability via Virtual Router Redundancy Protocol:

| Parameter | Primary | Backup |
|-----------|---------|--------|
| Priority | 100 | 50 |
| Preempt | Yes | - |
| Sync Group | vrrp-group-1 | vrrp-group-1 |

### Failover Behavior

1. Primary VyOS fails
2. Backup detects via VRRP heartbeat (1s interval)
3. Backup assumes VIP (3s timeout)
4. Connections re-establish through new master

## Conntrack Sync

Session synchronization between HA pair:

```yaml
# Automatically configured
conntrack_sync:
  interface: eth1
  peer: 10.0.0.2
  sync_queues: 4
```

Ensures active connections survive failover.

## BGP Support (Enterprise)

For multi-homed deployments:

```yaml
firewall:
  bgp:
    enabled: true
    asn: 65000
    neighbors:
      - address: 203.0.113.1
        remote_asn: 64512
```

## Monitoring

Exported metrics:

| Metric | Description |
|--------|-------------|
| `vyos_interface_bytes` | Interface traffic |
| `vyos_firewall_packets` | Packets per rule |
| `vyos_conntrack_count` | Active connections |
| `vyos_vrrp_state` | HA state (master/backup) |

## Troubleshooting

### Check VRRP State

```bash
show vrrp
show vrrp detail
```

### View Firewall Rules

```bash
show firewall
show firewall statistics
```

### Check Connections

```bash
show conntrack table
show nat translations
```

## See Also

- [Networking Layer](../03-layers/networking.md)
- [Security Model](../02-architecture/security-model.md)
- [Network Design](../02-architecture/network-design.md)
