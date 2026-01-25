---
id: public-ip-strategy
title: Public IP Strategy
sidebar_position: 6
---

# Public IP Strategy Guide

This guide covers everything you need to know about public IPs for your Soverstack infrastructure: options, providers, costs, and recommendations.

## Table of Contents

1. [Overview](#overview)
2. [IP Options](#ip-options)
3. [Provider-Specific Setup](#provider-specific-setup)
4. [Bandwidth Detection](#bandwidth-detection)
5. [Multi-Datacenter Considerations](#multi-datacenter-considerations)
6. [Recommendations](#recommendations)

---

## Overview

### Network Architecture

```
                        Internet
                           │
                           ▼
                    ┌─────────────┐
                    │ Public IPs  │  ← This guide
                    │  (Subnet)   │
                    └──────┬──────┘
                           │
                    ┌──────┴──────┐
                    │   Gateway   │  VyOS with VRRP
                    │    (HA)     │
                    └──────┬──────┘
                           │
                    ┌──────┴──────┐
                    │  Private    │  Unified internal network
                    │  Network    │  across all datacenters
                    └─────────────┘
```

### Key Concepts

| Term | Description |
|------|-------------|
| **Provider IPs** | IPs assigned by your hosting provider (Hetzner, OVH, etc.) |
| **Own IPs** | Your own IP block obtained from RIPE/ARIN with your ASN |
| **Failover IP** | Single IP that can be moved between servers |
| **IP Subnet** | Block of IPs (e.g., /29 = 5 usable IPs) |
| **vSwitch/vRack** | Private Layer 2 network between servers |
| **VRRP** | Protocol for automatic IP failover between gateways |
| **BGP** | Protocol to announce your own IPs to the Internet |

---

## IP Options

### Option A: Provider IPs (Recommended for Start)

Use IPs provided by your hosting provider.

**Pros:**
- Zero initial setup
- No extra cost (or minimal)
- Works immediately

**Cons:**
- Lost if you change provider
- Limited by provider quotas

**Cost:** ~10-50€/month for a subnet

**Best for:** Startups, SMBs, projects starting out

---

### Option B: Leased IPs (Broker/LIR)

Rent IPs from a broker or LIR (Local Internet Registry).

**Pros:**
- Portable between providers
- No large upfront investment
- Can announce via BGP

**Cons:**
- Monthly recurring cost
- Dependency on broker

**Providers:**
- [IPXO](https://ipxo.com) - IP marketplace
- [Interlir](https://interlir.com) - European broker
- [IPv4 Global](https://ipv4global.com) - Global marketplace

**Cost:**
- /24 (256 IPs): ~200-500€/month
- /28 (16 IPs): ~50-100€/month
- ASN: ~50€/year (via sponsor)

**Best for:** Companies wanting portability without large investment

---

### Option C: Own IPs (Full Sovereignty)

Purchase your own IP block and ASN.

**Pros:**
- 100% sovereign - you own the asset
- No dependencies
- Portable anywhere
- Can do Anycast (same IP in multiple DCs)

**Cons:**
- High initial cost
- Technical BGP setup required
- Need multihoming for HA

**How to obtain:**
1. Get ASN from RIPE NCC (via LIR sponsor or direct membership)
2. Buy IPv4 block on secondary market
3. Configure BGP on your routers

**Cost:**
- /24 (256 IPs): ~10,000-20,000€ (one-time purchase)
- ASN via sponsor: ~200€/year
- Direct RIPE membership: ~1,400€/year

**Best for:** Established enterprises, MSPs, cloud providers

---

### Option D: IPv6 + NAT64/Cloudflare

Use free IPv6 with translation for IPv4 clients.

**Pros:**
- Free and unlimited
- Future-proof

**Cons:**
- Not all clients support IPv6
- Added complexity with NAT64
- Debugging harder

**Best for:** Technical projects, early adopters

---

## Provider-Specific Setup

### Hetzner

#### Getting IPs

1. **Failover IP** (single IP)
   - Robot → Server → IPs → Order Failover IP
   - Cost: ~1€/month
   - Can be moved via API

2. **Subnet** (recommended for HA)
   - Robot → Server → IPs → Order Subnet
   - Available: /29 (5 IPs), /28 (13 IPs)
   - Cost: ~15-30€/month

#### Routing Subnet to vSwitch (Critical for HA)

This is the **recommended setup** for high availability:

```
1. Create vSwitch
   Robot → vSwitch → Create

2. Add your servers to vSwitch
   Robot → vSwitch → Add Servers

3. Order subnet
   Robot → IPs → Order Subnet

4. Route subnet to vSwitch
   Robot → IPs → Your Subnet → Route to → vSwitch
```

**Result:** Any server on the vSwitch can use the IPs. VRRP failover works without API calls.

#### Network Configuration (Proxmox)

```bash
# /etc/network/interfaces

# Physical interface
auto eth0
iface eth0 inet manual

# Public bridge (for VyOS)
auto vmbr0
iface vmbr0 inet static
    address YOUR_MAIN_IP/32
    gateway YOUR_GATEWAY
    bridge-ports eth0
    bridge-stp off
    bridge-fd 0

# vSwitch bridge (private + routed subnet)
auto vmbr1
iface vmbr1 inet manual
    bridge-ports eth0.4000  # VLAN ID from vSwitch config
    bridge-stp off
    bridge-fd 0
```

#### VyOS VRRP Configuration

```
# VyOS-1 (Master)
set interfaces ethernet eth0 address '203.0.113.10/29'
set high-availability vrrp group GATEWAY {
    interface eth0
    virtual-address 203.0.113.2/29
    vrid 10
    priority 100
}

# VyOS-2 (Backup)
set interfaces ethernet eth0 address '203.0.113.11/29'
set high-availability vrrp group GATEWAY {
    interface eth0
    virtual-address 203.0.113.2/29
    vrid 10
    priority 90
}
```

---

### OVH

#### Getting IPs

1. **Failover IP**
   - Manager → IP → Order
   - Cost: ~2€/month

2. **IP Block**
   - Manager → IP → Order IP Block
   - /29 to /24 available
   - Easier to obtain than Hetzner

#### Routing to vRack

OVH's vRack is equivalent to Hetzner's vSwitch:

```
1. Create vRack
   Manager → vRack → Create

2. Add dedicated servers to vRack
   Manager → vRack → Add Services

3. Order IP block
   Manager → IP → Order Block

4. Move IP block to vRack
   Manager → IP → Your Block → Move to vRack
```

#### Network Configuration

```bash
# /etc/network/interfaces

# vRack interface
auto eth1
iface eth1 inet static
    address 10.0.1.1/24  # Private vRack IP

# For routed public IPs on vRack
auto eth1:0
iface eth1:0 inet static
    address 203.0.113.2/29  # Your public IP
```

---

### Scaleway

#### Getting IPs

1. **Flexible IP**
   - Console → Instances → Flexible IPs
   - Can be attached/detached from instances

2. **IP Block**
   - Available for Dedibox (dedicated servers)
   - Console → Dedibox → IP Management

#### Private Networks

Scaleway uses VPC (Virtual Private Cloud):

```
1. Create VPC
   Console → VPC → Create

2. Create Private Network
   Console → VPC → Private Networks → Create

3. Attach servers
   Console → Instances → Network → Attach to Private Network
```

---

### Equinix Metal

#### Getting IPs

Equinix Metal provides more flexibility:

1. **Elastic IPs**
   - Console → IPs → Request
   - Can request /29 or larger

2. **BYOIP (Bring Your Own IP)**
   - Announce your own IPs via BGP
   - Full BGP support included

#### BGP Setup

```yaml
# Equinix supports BGP natively
bgp:
  local_asn: 65000  # Private ASN or your own
  neighbors:
    - ip: 169.254.255.1
      remote_asn: 65530  # Equinix peer
    - ip: 169.254.255.2
      remote_asn: 65530
```

---

### Generic / On-Premise

For colocation or on-premise:

1. **Get IPs from your upstream provider**
   - Transit provider allocates IPs
   - Usually /29 minimum

2. **Get your own IPs**
   - RIPE NCC membership or sponsor
   - Buy /24 on secondary market
   - Announce via BGP to transit

---

## Bandwidth Detection

### Check Link Speed

```bash
# Using ethtool
ethtool eth0 | grep Speed
# Output: Speed: 1000Mb/s or Speed: 10000Mb/s

# Using sysfs
cat /sys/class/net/eth0/speed
# Output: 1000 (Mbps) or 10000 (Mbps)

# Check all interfaces
for iface in $(ls /sys/class/net/); do
  speed=$(cat /sys/class/net/$iface/speed 2>/dev/null)
  if [ ! -z "$speed" ] && [ "$speed" != "-1" ]; then
    echo "$iface: ${speed}Mbps"
  fi
done
```

### Test Actual Bandwidth

```bash
# Install iperf3
apt install iperf3

# Test to public server
iperf3 -c speedtest.serverius.net -p 5002

# Test between your servers
# On server A (receiver):
iperf3 -s

# On server B (sender):
iperf3 -c <server-a-ip>
```

### Typical Provider Speeds

| Provider | Included | Upgradable |
|----------|----------|------------|
| Hetzner AX41-AX51 | 1 Gbps | 10 Gbps (on request) |
| Hetzner AX101+ | 1 Gbps (10G NIC) | 10 Gbps |
| OVH Advance | 1 Gbps | 10 Gbps |
| OVH High Grade | 10 Gbps | 25 Gbps |
| Scaleway Dedibox | 1-10 Gbps | Depends on model |
| Equinix Metal | 10-25 Gbps | 100 Gbps |

### Private Network Speeds

| Provider | Private Network | Speed |
|----------|-----------------|-------|
| Hetzner | vSwitch | Up to NIC speed (1G or 10G) |
| OVH | vRack | 10 Gbps |
| Scaleway | VPC | 10 Gbps |
| Equinix | Layer 2 | 10-100 Gbps |

---

## Multi-Datacenter Considerations

### With Provider IPs (Recommended Start)

```
┌─────────────────────────────────────────────────────────────────┐
│  Each DC has its own provider IPs                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│     DC-A (Paris)                    DC-B (Frankfurt)            │
│     IPs: 88.99.100.0/29             IPs: 95.216.50.0/29         │
│            │                               │                    │
│            ▼                               ▼                    │
│        VyOS-A                          VyOS-B                   │
│            │                               │                    │
│            └───────── WireGuard ───────────┘                    │
│                      (encrypted)                                │
│                                                                 │
│  Inter-DC latency: 5-20ms (physical distance)                   │
│  This latency exists regardless of IP ownership                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**What works:**
- Each DC independently accessible
- DNS failover between DCs
- Private mesh between DCs (WireGuard/Headscale)

**What doesn't work:**
- Same IP in multiple DCs (no Anycast)
- Instant failover (DNS TTL delay)

### With Own IPs (Anycast)

```
┌─────────────────────────────────────────────────────────────────┐
│  Same IPs announced from multiple DCs                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│     DC-A (Paris)                    DC-B (Frankfurt)            │
│     Announces: 203.0.113.0/24       Announces: 203.0.113.0/24   │
│            │                               │                    │
│            ▼                               ▼                    │
│        VyOS-A                          VyOS-B                   │
│        (BGP)                           (BGP)                    │
│            │                               │                    │
│            └───────── WireGuard ───────────┘                    │
│                                                                 │
│  User in Paris → DC-A (BGP shortest path)                       │
│  User in Berlin → DC-B (BGP shortest path)                      │
│  DC-A down → Traffic automatically goes to DC-B                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Advantages:**
- Automatic geographic routing
- Instant failover (~5s BGP convergence)
- Same IP everywhere

### Inter-DC Latency (Cannot Be Avoided)

| Route | Typical Latency |
|-------|-----------------|
| Same DC | <1ms |
| Paris ↔ Frankfurt | 10-15ms |
| Europe ↔ US East | 80-100ms |
| Europe ↔ Asia | 150-250ms |

**This latency exists regardless of IP type.** Own IPs give you Anycast (user goes to closest DC), not lower latency between DCs.

### Recommendation: Start Simple

```yaml
# Phase 1: Provider IPs (start here)
public_network:
  mode: provider
  # Each DC has its own IPs from the provider
  # DNS-based failover between DCs

# Phase 2: Own IPs (when you need Anycast)
public_network:
  mode: owned
  asn: 212345
  prefix: "203.0.113.0/24"
  # Announce from all DCs
  # BGP handles routing and failover
```

---

## Recommendations

### By Company Size

| Profile | Recommended Option | Cost | Complexity |
|---------|-------------------|------|------------|
| Startup | Provider IPs | ~15-50€/mo | Low |
| SMB | Provider IPs + Cloudflare | ~20-100€/mo | Low |
| Enterprise | Leased IPs | ~200-500€/mo | Medium |
| Cloud Provider/MSP | Own IPs | ~15k one-time | High |

### By Use Case

| Use Case | Recommended Setup |
|----------|-------------------|
| Single DC | Provider subnet on vSwitch/vRack |
| Multi-DC (basic) | Provider IPs per DC + DNS failover |
| Multi-DC (HA) | Own IPs + BGP Anycast |
| Multi-provider | Own IPs (only way to be portable) |

### Quick Start Checklist

1. [ ] Order subnet from provider (not just single IP)
2. [ ] Route subnet to vSwitch/vRack (not single server)
3. [ ] Configure VRRP between VyOS instances
4. [ ] Test failover (kill master, verify backup takes over)
5. [ ] Document your IPs in `networking.yaml`

---

## Configuration in Soverstack

```yaml
# networking.yaml

public_network:
  # Choose your mode
  mode: provider  # or: leased, owned

  # Provider IPs (simple)
  provider:
    subnet: "203.0.113.0/29"
    gateway: "203.0.113.1"
    vip_gateway: "203.0.113.2"      # VRRP VIP for gateway
    usable:
      - "203.0.113.3"               # Service 1
      - "203.0.113.4"               # Service 2
      - "203.0.113.5"               # Service 3

  # Leased IPs (via broker)
  # leased:
  #   provider: ipxo
  #   asn: 212345  # Provided by broker
  #   prefix: "198.51.100.0/24"

  # Own IPs (full control)
  # owned:
  #   asn: 212345
  #   prefix: "198.51.100.0/24"
  #   bgp_peers:
  #     - name: transit-cogent
  #       ip: "169.254.0.1"
  #       remote_asn: 174

gateway:
  ha:
    enabled: true
    protocol: vrrp
    vip: "{{ public_network.provider.vip_gateway }}"
```

---

## Further Reading

- [RIPE NCC - Getting Internet Resources](https://www.ripe.net/manage-ips-and-asns/resource-management/)
- [Hetzner vSwitch Documentation](https://docs.hetzner.com/robot/dedicated-server/network/vswitch/)
- [OVH vRack Documentation](https://docs.ovh.com/gb/en/dedicated/configuring-vrack/)
- [VyOS VRRP Configuration](https://docs.vyos.io/en/latest/configuration/highavailability/index.html)
- [BGP for Beginners](https://www.kentik.com/blog/bgp-for-beginners/)
