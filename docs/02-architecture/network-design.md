# Network Design

Soverstack implements a layered network architecture with security zones.

## Network Topology

```
                            ┌─────────────────┐
                            │    Internet     │
                            └────────┬────────┘
                                     │
                            ┌────────▼────────┐
                            │   Public IPs    │
                            │ 203.0.113.0/28  │
                            └────────┬────────┘
                                     │
        ┌────────────────────────────┼────────────────────────────┐
        │                            │                            │
   ┌────▼────┐                 ┌─────▼─────┐                ┌─────▼─────┐
   │ VyOS-01 │◄───── VRRP ────►│ VyOS-02   │                │  Ingress  │
   │  .2     │                 │   .2      │                │    .4     │
   └────┬────┘                 └─────┬─────┘                └─────┬─────┘
        │                            │                            │
        └────────────────────────────┼────────────────────────────┘
                                     │
    ═══════════════════════════════════════════════════════════════════
    │                        MANAGEMENT VLAN (10)                     │
    │                         10.0.10.0/24                            │
    ═══════════════════════════════════════════════════════════════════
                                     │
    ═══════════════════════════════════════════════════════════════════
    │                        SERVICES VLAN (20)                       │
    │                         10.0.20.0/24                            │
    │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │
    │  │Headscale │ │ Keycloak │ │ OpenBao  │ │ PowerDNS │           │
    │  └──────────┘ └──────────┘ └──────────┘ └──────────┘           │
    ═══════════════════════════════════════════════════════════════════
                                     │
    ═══════════════════════════════════════════════════════════════════
    │                        DATABASE VLAN (30)                       │
    │                         10.0.30.0/24                            │
    │  ┌──────────┐ ┌──────────┐ ┌──────────┐                        │
    │  │Postgres-1│ │Postgres-2│ │Postgres-3│                        │
    │  └──────────┘ └──────────┘ └──────────┘                        │
    ═══════════════════════════════════════════════════════════════════
                                     │
    ═══════════════════════════════════════════════════════════════════
    │                       KUBERNETES VLAN (40)                      │
    │                         10.0.40.0/24                            │
    │  ┌──────────┐ ┌──────────┐ ┌──────────────────────────────┐    │
    │  │ Master-1 │ │ Master-2 │ │ Workers (600+)               │    │
    │  └──────────┘ └──────────┘ └──────────────────────────────┘    │
    │                                                                 │
    │  Pod Network: 10.244.0.0/16    Service Network: 10.96.0.0/12   │
    ═══════════════════════════════════════════════════════════════════
                                     │
    ═══════════════════════════════════════════════════════════════════
    │                         STORAGE VLAN (50)                       │
    │                         10.0.50.0/24                            │
    │  ┌────────────────────────────────────────────────────────┐    │
    │  │                    Ceph Cluster                         │    │
    │  └────────────────────────────────────────────────────────┘    │
    ═══════════════════════════════════════════════════════════════════
```

## VLAN Configuration

| VLAN ID | Name | Subnet | Purpose | MTU |
|---------|------|--------|---------|-----|
| 10 | Management | 10.0.10.0/24 | Proxmox management, SSH | 1500 |
| 11 | Cluster | 10.0.11.0/24 | PVE cluster sync, Corosync | 9000 |
| 20 | Services | 10.0.20.0/24 | Infrastructure services | 1500 |
| 30 | Database | 10.0.30.0/24 | Database traffic | 9000 |
| 40 | Kubernetes | 10.0.40.0/24 | K8s nodes | 9000 |
| 50 | Ceph Public | 10.0.50.0/24 | Ceph client traffic | 9000 |
| 51 | Ceph Private | 10.0.51.0/24 | Ceph replication | 9000 |
| 100 | VPN | 100.64.0.0/10 | Tailscale/Headscale | 1280 |

## Public IP Allocation

```yaml
public_ip:
  type: allocated_block
  cidr: "203.0.113.0/28"
  gateway: "203.0.113.1"
  allocation:
    firewall: "203.0.113.2"    # VyOS VRRP VIP
    vpn: "203.0.113.3"          # Headscale
    ingress: "203.0.113.4"      # K8s Ingress
    # .5-.14 available for services
```

## Firewall Zones

### Zone: WAN
- Interface: eth0
- Rules: Default deny, allow established

### Zone: DMZ
- Interface: eth1
- Services: Ingress, public-facing apps
- Rules: Limited inbound, full outbound

### Zone: SERVICES
- Interface: eth2
- Services: All infrastructure services
- Rules: VPN access only, inter-service allowed

### Zone: DATABASE
- Interface: eth3
- Services: PostgreSQL, Redis
- Rules: Service VLAN access only

## Traffic Flow

### External → Internal Service

```
Internet → Public IP → VyOS → VPN Check → Service
                         ↓
                   (if no VPN)
                         ↓
                      REJECT
```

### Internal Service → Service

```
Service A → Firewall Rules Check → Service B
                    ↓
              (if allowed)
                    ↓
                 ALLOW
```

### VPN Access

```
User → Headscale (auth) → Tailscale Network → Internal Services
              ↓
        Keycloak OIDC
```

## DNS Resolution

### Internal DNS (PowerDNS)

```
*.internal.example.com → PowerDNS → Internal IPs
```

### External DNS

```
*.example.com → Cloudflare/External → Public IPs
```

## Load Balancing

### Layer 4 (HAProxy)

- PostgreSQL: Round-robin to read replicas
- K8s API: Active-passive to masters

### Layer 7 (Traefik)

- HTTP/HTTPS ingress
- Automatic TLS
- Path-based routing

## Network Security

### Segmentation
- Each VLAN isolated by default
- Cross-VLAN traffic through firewall
- Micro-segmentation for K8s pods

### Encryption
- All external traffic: TLS 1.3
- Internal traffic: mTLS where supported
- Database: SSL required
- Storage: Ceph encryption at rest

## See Also

- [VyOS Firewall](../04-services/vyos-firewall.md)
- [Headscale VPN](../04-services/headscale-vpn.md)
- [Networking Layer](../03-layers/networking.md)
