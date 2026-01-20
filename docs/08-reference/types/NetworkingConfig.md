---
id: networking-config
title: NetworkingConfig
sidebar_position: 20
---

# NetworkingConfig

Configuration du layer networking.

## Structure

```yaml
# networking.yaml
public_ip:                           # optionnel
  type: allocated_block
  allocated_block:
    block: "203.0.113.0/27"
    gateway: "203.0.113.1"
    usable_range: "203.0.113.2-203.0.113.30"
  failover:
    type: vrrp
    routers:
      - name: vyos-1
        vm_id: 10
        priority: 100
      - name: vyos-2
        vm_id: 11
        priority: 99

dns:                                 # optionnel
  type: powerdns
  deployment: vm
  powerdns:
    vm_ids: [70, 71, 72]
    loadbalancer_vm_ids: [50, 51]
    database: core-cluster
  zones:
    - domain: example.com
      type: primary

vpn:                                 # optionnel
  enabled: true
  type: headscale
  deployment: vm
  vm_ids: [100, 101]
  database: core-cluster
  vpn_subnet: "100.64.0.0/10"
  oidc_enforced: true

firewall:                            # optionnel
  enabled: true
  type: vyos
  deployment: vm
  vm_ids: [10, 11]
```

## Propriétés

| Propriété | Type | Requis | Description |
|-----------|------|--------|-------------|
| `public_ip` | [PublicIPConfig](./PublicIPConfig.md) | Non | Configuration du bloc IP public |
| `dns` | [DNSConfig](./DNSConfig.md) | Non | Configuration DNS |
| `vpn` | [VPNConfig](./VPNConfig.md) | Non | Configuration VPN |
| `firewall` | [FirewallConfig](./FirewallConfig.md) | Non | Configuration firewall |

## Voir aussi

- [PublicIPConfig](./PublicIPConfig.md)
- [DNSConfig](./DNSConfig.md)
- [VPNConfig](./VPNConfig.md)
- [FirewallConfig](./FirewallConfig.md)
