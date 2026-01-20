---
id: public-ip-config
title: PublicIPConfig
sidebar_position: 44
---

# PublicIPConfig

Configuration du bloc d'IPs publiques.

## Definition

```typescript
export type PublicIPConfigType = "allocated_block" | "bgp";

export interface PublicIPConfig {
  type: PublicIPConfigType;

  allocated_block?: {
    block: string;
    gateway: string;
    usable_range: string;
  };

  failover?: {
    type: "vrrp";
    routers: {
      name: string;
      vm_id: number;
      priority: number;
    }[];
    auth?: CredentialRef;
  };

  bgp?: {
    status: "coming_soon";
    asn?: number;
    ip_blocks?: string[];
  };
}
```

## Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `type` | `"allocated_block" \| "bgp"` | Yes | IP configuration type |
| `allocated_block` | `object` | No | Allocated block config |
| `failover` | `object` | No | VRRP failover config |
| `bgp` | `object` | No | BGP config (coming soon) |

## Allocated Block Object

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `block` | `string` | Yes | CIDR block (e.g., "203.0.113.0/27") |
| `gateway` | `string` | Yes | Gateway IP |
| `usable_range` | `string` | Yes | Usable IP range |

## Failover Object

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `type` | `"vrrp"` | Yes | Failover type |
| `routers` | `array` | Yes | Router definitions |
| `auth` | [`CredentialRef`](./CredentialRef.md) | No | VRRP authentication |

## Router Definition

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `name` | `string` | Yes | Router name |
| `vm_id` | `number` | Yes | Firewall VM ID |
| `priority` | `number` | Yes | VRRP priority (higher = preferred) |

## Example

```yaml
public_ip:
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
    auth:
      type: vault
      path: secret/vrrp/auth
```

## Related Types

- [NetworkingConfig](./NetworkingConfig.md)
- [FloatingIP](./FloatingIP.md)
- [CredentialRef](./CredentialRef.md)
