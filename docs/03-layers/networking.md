# Networking Layer

The networking layer is split into two files:
- **Global** (`networking.yaml`) - DNS, VPN, global mesh networks
- **Zone** (`zones/{zone}/networking.yaml`) - Public IPs, zone mesh networks

## File Structure

```
project/
├── networking.yaml                      # GLOBAL
└── regions/eu/zones/main/
    └── networking.yaml                  # ZONE
```

---

## Global Networking (`networking.yaml`)

### Schema Overview

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `dns` | [`DNSConfig`](#dns-config) | Yes | DNS configuration |
| `vpn` | [`VPNConfig`](#vpn-config) | Yes | VPN (Headscale) configuration |
| `mesh_networks` | [`MeshNetwork[]`](#mesh-network) | Yes | Global mesh networks |

### DNS Config

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `type` | `powerdns` \| `cloudflare` \| `hybrid` | Yes | DNS provider type |
| `powerdns` | object | If type=powerdns/hybrid | PowerDNS config |
| `powerdns.database` | string | Yes | Database name |
| `powerdns.vm_ids` | number[] | Yes | PowerDNS VM IDs |
| `dnsdist` | object | No | Load balancer config |
| `dnsdist.vm_ids` | number[] | Yes | dnsdist VM IDs |
| `cloudflare` | object | If type=cloudflare/hybrid | Cloudflare config |
| `cloudflare.credentials` | CredentialRef | Yes | API token |
| `cloudflare.proxy` | boolean | No | Enable orange cloud |
| `cloudflare.sync` | `push` | If hybrid | Sync direction |

### VPN Config

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `type` | `headscale` | Yes | VPN type |
| `database` | string | Yes | Database name |
| `vm_ids` | number[] | Yes | Headscale server VM IDs |

### Mesh Network (Global)

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `name` | string | Yes | Network name |
| `subnet` | string (CIDR) | Yes | Network subnet |
| `port` | number | Yes | WireGuard port |
| `purpose` | string | No | Description |

### Global Mesh Networks

| Name | Subnet | Port | Purpose |
|------|--------|------|---------|
| `management` | 10.10.0.0/16 | 51820 | SSH, monitoring, admin |
| `backup` | 10.40.0.0/16 | 51825 | Hub to zones backup traffic |

### Complete Example (Global)

```yaml
# networking.yaml (GLOBAL)

dns:
  type: powerdns             # powerdns | cloudflare | hybrid

  # type: powerdns
  powerdns:
    database: powerdns
    vm_ids: [50, 51]

  dnsdist:
    vm_ids: [60, 61]

  # type: cloudflare
  # cloudflare:
  #   credentials:
  #     type: env
  #     var_name: CLOUDFLARE_API_TOKEN
  #   proxy: true

  # type: hybrid (PowerDNS + Cloudflare)
  # powerdns:
  #   database: powerdns
  #   vm_ids: [50, 51]
  # dnsdist:
  #   vm_ids: [60, 61]
  # cloudflare:
  #   credentials:
  #     type: env
  #     var_name: CLOUDFLARE_API_TOKEN
  #   proxy: true
  #   sync: push

  # Soverstack auto-generates:
  # - Glue records (ns1/ns2 IPs from zone's public_ips)
  # - A records for all VMs
  # - Wildcard for ingress

vpn:
  type: headscale
  database: headscale
  vm_ids: [100, 101]

mesh_networks:
  - name: management
    subnet: 10.10.0.0/16
    port: 51820
    purpose: SSH, monitoring, admin (global access)

  - name: backup
    subnet: 10.40.0.0/16
    port: 51825
    purpose: Backup traffic (hub to zones)
```

---

## Zone Networking (`zones/{zone}/networking.yaml`)

### Schema Overview

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `zone` | string | Yes | Zone name |
| `region` | string | Yes | Region name |
| `public_ips` | [`PublicIPsConfig`](#public-ips-config) | Yes | Public IP configuration |
| `mesh_networks` | [`MeshNetwork[]`](#mesh-network-zone) | Yes | Zone mesh networks |

### Public IPs Config

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `type` | `allocated_block` \| `bgp` | Yes | IP allocation type |
| `allocated_block` | object | If type=allocated_block | Static block config |
| `allocated_block.block` | string (CIDR) | Yes | IP block |
| `allocated_block.gateway` | string | Yes | Gateway IP |
| `allocated_block.usable_range` | string | Yes | Usable IP range |
| `bgp` | object | If type=bgp | BGP config (coming soon) |
| `bgp.asn` | number | Yes | Your ASN |
| `bgp.ip_blocks` | string[] | Yes | IP blocks to announce |

### Mesh Network (Zone)

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `name` | string | Yes | Network name |
| `subnet` | string (CIDR) | Yes | Network subnet |
| `port` | number | Yes | WireGuard port |
| `mtu` | number | No | MTU (default 1420, 8940 for jumbo) |
| `purpose` | string | No | Description |

### Zone Mesh Networks

| Name | Subnet | Port | MTU | Purpose |
|------|--------|------|-----|---------|
| `services` | 10.50.x.0/24 | 51826 | 1420 | VyOS, HAProxy, local services |
| `ceph-public` | 10.20.x.0/24 | 51821 | 1420 | VM I/O to Ceph |
| `ceph-cluster` | 10.21.x.0/24 | 51822 | 8940 | Ceph replication (latency critical) |
| `proxmox-public` | 10.30.x.0/24 | 51823 | 1420 | Proxmox API/UI |
| `proxmox-cluster` | 10.31.x.0/24 | 51824 | 1420 | Corosync, live migration |

### Complete Example (Zone)

```yaml
# zones/main/networking.yaml (ZONE)

zone: main
region: eu

public_ips:
  type: allocated_block      # allocated_block | bgp

  allocated_block:
    block: 203.0.113.0/29
    gateway: 203.0.113.1
    usable_range: 203.0.113.2-203.0.113.6

  # bgp:
  #   asn: 210123
  #   ip_blocks:
  #     - 203.0.113.0/24

  # Soverstack auto-assigns IPs to:
  # - powerdns (if dns.type = powerdns)
  # - vyos (firewall)
  # - haproxy-edge (ingress)
  # And configures VRRP failover automatically

mesh_networks:
  - name: services
    subnet: 10.50.0.0/24
    port: 51826
    purpose: VyOS, HAProxy, local services

  - name: ceph-public
    subnet: 10.20.0.0/24
    port: 51821
    purpose: VM I/O to Ceph

  - name: ceph-cluster
    subnet: 10.21.0.0/24
    port: 51822
    mtu: 8940
    purpose: Ceph replication (latency critical)

  - name: proxmox-public
    subnet: 10.30.0.0/24
    port: 51823
    purpose: Proxmox API/UI

  - name: proxmox-cluster
    subnet: 10.31.0.0/24
    port: 51824
    purpose: Corosync, live migration (latency critical)
```

---

## IP Auto-Assignment

Soverstack automatically assigns public IPs based on VM roles:

| Order | Service | VMs |
|-------|---------|-----|
| 1 | PowerDNS | 2 (if dns.type = powerdns) |
| 2 | VyOS (firewall) | 2 |
| 3 | HAProxy edge (ingress) | 2 |

**Example with /29 block (6 usable IPs):**

```
Block: 203.0.113.0/29
Gateway: 203.0.113.1

Auto-assigned:
  203.0.113.2 → powerdns-01
  203.0.113.3 → powerdns-02
  203.0.113.4 → vyos-01
  203.0.113.5 → vyos-02
  203.0.113.6 → haproxy-edge-01
  (need more IPs for haproxy-edge-02)
```

---

## Scope Summary

| Element | File | Scope | Why |
|---------|------|-------|-----|
| DNS (PowerDNS) | networking.yaml | Global | Single source of truth |
| VPN (Headscale) | networking.yaml | Global | Single control plane |
| mesh-management | networking.yaml | Global | Admin access everywhere |
| mesh-backup | networking.yaml | Global | Cross-zone backup |
| Public IPs | zones/{zone}/networking.yaml | Zone | Physical location |
| mesh-services | zones/{zone}/networking.yaml | Zone | Local services |
| mesh-ceph-* | zones/{zone}/networking.yaml | Zone | Latency critical |
| mesh-proxmox-* | zones/{zone}/networking.yaml | Zone | Latency critical |

---

## Validation Rules

### All Tiers

| Rule | Severity |
|------|----------|
| Valid CIDR format | Error |
| Valid IP addresses | Error |
| Mesh subnets don't overlap | Error |

### Production/Enterprise

| Rule | Severity |
|------|----------|
| DNS required | Critical |
| VPN required | Critical |
| Minimum 2 PowerDNS VMs | Critical |
| Minimum 2 Headscale VMs | Critical |
| Public IP block required | Critical |

---

## See Also

- [Network Design](../02-architecture/network-design.md)
- [Network Isolation Architecture](../10-deep-dive/05-network-isolation-architecture.md)
- [Deployment Scopes](../10-deep-dive/08-deployment-scopes.md)
- [VyOS Firewall](../04-services/vyos-firewall.md)
- [Headscale VPN](../04-services/headscale-vpn.md)
- [PowerDNS](../04-services/powerdns.md)
