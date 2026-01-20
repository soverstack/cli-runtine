# Networking Layer

The networking layer configures public IPs, firewall, VPN, and DNS.

## Schema

Defined by [`NetworkingConfig`](../08-reference/types/NetworkingConfig.md) interface.

## Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `public_ip` | [`PublicIPConfig`](#public-ip-config) | ❌ | Public IP block configuration |
| `firewall` | [`FirewallConfig`](#firewall-config) | ✅ (prod) | Firewall configuration |
| `vpn` | [`VPNConfig`](#vpn-config) | ✅ (prod) | VPN configuration |
| `dns` | [`DNSConfig`](#dns-config) | ❌ | DNS configuration |

## Public IP Config

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `type` | `"allocated_block"` \| `"bgp"` | ✅ | IP allocation type |
| `allocated_block` | object | ❌ | Static IP block config |
| `allocated_block.block` | `string` | ✅ | CIDR block (e.g., `203.0.113.0/28`) |
| `allocated_block.gateway` | `string` | ✅ | Gateway IP |
| `allocated_block.usable_range` | `string` | ✅ | Usable IP range |
| `failover` | object | ❌ | VRRP failover config |
| `bgp` | object | ❌ | BGP configuration (coming soon) |

## Firewall Config

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `enabled` | `boolean` | ✅ | Enable firewall |
| `type` | `"vyos"` \| `"opnsense"` \| `"pfsense"` | ✅ | Firewall type |
| `deployment` | `"vm"` | ✅ | Deployment type |
| `vm_ids` | `number[]` | ✅ | VM IDs (2 for HA) |
| `public_ip` | [`FloatingIP`](../08-reference/types/FloatingIP.md) | ❌ | Public IP assignment |
| `domain` | `string` | ❌ | Firewall domain |

## VPN Config

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `enabled` | `boolean` | ✅ | Enable VPN |
| `type` | `"headscale"` \| `"wireguard"` \| `"netbird"` | ✅ | VPN type |
| `deployment` | `"vm"` | ✅ | Deployment type |
| `vm_ids` | `number[]` | ✅ | VM IDs (2 for HA) |
| `public_ip` | [`FloatingIP`](../08-reference/types/FloatingIP.md) | ❌ | Public IP assignment |
| `database` | `string` | ❌ | Database name reference |
| `vpn_subnet` | `string` | ❌ | VPN subnet (default: `100.64.0.0/10`) |
| `oidc_enforced` | `true` | ✅ | Always true, cannot be disabled |

## DNS Config

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `type` | `"powerdns"` \| `"cloudflare"` \| `"hybrid"` | ✅ | DNS type |
| `deployment` | `"vm"` \| `"cluster"` | ✅ | Deployment type |
| `powerdns` | object | ❌ | PowerDNS config |
| `powerdns.vm_ids` | `number[]` | ✅ | PowerDNS VM IDs |
| `powerdns.loadbalancer_vm_ids` | `number[]` | ❌ | dnsdist VM IDs |
| `powerdns.database` | `string` | ✅ | Database name |
| `cloudflare` | object | ❌ | Cloudflare config |
| `zones` | [`DNSZone[]`](#dns-zone) | ✅ | DNS zones |

### DNS Zone

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `domain` | `string` | ✅ | Zone domain |
| `type` | `"primary"` \| `"secondary"` | ✅ | Zone type |
| `internal` | `boolean` | ❌ | Internal-only zone |
| `nameservers` | `string[]` | ❌ | Nameserver hostnames |

## Complete Example

```yaml
# layers/networking.yaml

# Public IP block configuration
public_ip:
  type: allocated_block
  allocated_block:
    block: "203.0.113.0/28"
    gateway: "203.0.113.1"
    usable_range: "203.0.113.2-203.0.113.14"
  failover:
    type: vrrp
    routers:
      - name: vyos-01
        vm_id: 1
        priority: 100
      - name: vyos-02
        vm_id: 2
        priority: 50

# Firewall (VyOS)
firewall:
  enabled: true
  type: vyos
  deployment: vm
  vm_ids: [1, 2]                    # From core-compute.yaml
  public_ip:
    ip: "203.0.113.2"
    vrrp_id: 10
  domain: firewall.example.com

# VPN (Headscale)
vpn:
  enabled: true
  type: headscale
  deployment: vm
  vm_ids: [100, 101]                # From core-compute.yaml
  public_ip:
    ip: "203.0.113.3"
    vrrp_id: 20
  database: headscale               # From core-databases.yaml
  vpn_subnet: "100.64.0.0/10"
  oidc_enforced: true               # Cannot be changed

# DNS (PowerDNS)
dns:
  type: powerdns
  deployment: vm
  powerdns:
    vm_ids: [70, 71]                # From core-compute.yaml
    loadbalancer_vm_ids: [50, 51]   # dnsdist from core-compute.yaml
    database: powerdns              # From core-databases.yaml
  zones:
    - domain: example.com
      type: primary
    - domain: internal.example.com
      type: primary
      internal: true
```

## VM ID References

The networking layer references VMs from `core-compute.yaml`:

| Service | VM IDs | Range |
|---------|--------|-------|
| VyOS Firewall | 1, 2 | FIREWALL (1-49) |
| dnsdist | 50, 51 | DNS_LB (50-69) |
| PowerDNS | 70, 71 | DNS_SERVER (70-99) |
| Headscale | 100, 101 | BASTION (100-149) |

## Validation Rules

### All Tiers

| Rule | Severity |
|------|----------|
| Valid CIDR format | Error |
| Valid IP addresses | Error |
| `oidc_enforced` must be `true` | Critical |

### Production/Enterprise

| Rule | Severity |
|------|----------|
| Firewall required | Critical |
| VPN required | Critical |
| Minimum 2 firewall VMs | Critical |
| Minimum 2 VPN VMs | Critical |

## FloatingIP

For services with public IPs:

```yaml
public_ip:
  ip: "203.0.113.2"
  vrrp_id: 10                    # 1-255, unique per IP
  health_check:
    type: tcp
    port: 443
    interval: "5s"
```

## See Also

- [NetworkingConfig Type](../08-reference/types/NetworkingConfig.md)
- [VyOS Firewall](../04-services/vyos-firewall.md)
- [Headscale VPN](../04-services/headscale-vpn.md)
- [PowerDNS](../04-services/powerdns.md)
- [Network Design](../02-architecture/network-design.md)
