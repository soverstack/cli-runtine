# Headscale VPN

Headscale provides zero-trust VPN access using the Tailscale protocol.

## Overview

```
┌─────────────────────────────────────────────────────────────┐
│                  Headscale Architecture                      │
│                                                              │
│  ┌──────────────┐     ┌──────────────┐                      │
│  │  Headscale   │────▶│  Headscale   │  Active-Passive HA   │
│  │  Primary     │     │  Secondary   │                      │
│  │  (vm_id:100) │     │  (vm_id:101) │                      │
│  └──────┬───────┘     └──────────────┘                      │
│         │                                                    │
│         ▼                                                    │
│  ┌──────────────┐                                           │
│  │  PostgreSQL  │  Shared database for HA                   │
│  └──────────────┘                                           │
└─────────────────────────────────────────────────────────────┘
```

## Schema

Defined by [`VPNConfig`](../08-reference/types/VPNConfig.md) interface.

## Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `enabled` | `boolean` | Yes | Enable/disable VPN |
| `type` | `"headscale" \| "wireguard" \| "netbird"` | Yes | VPN implementation type |
| `deployment` | `"vm"` | Yes | Deployment type (only VM supported) |
| `vm_ids` | `number[]` | Yes | VM IDs for Headscale instances |
| `public_ip` | [`FloatingIP`](../08-reference/types/FloatingIP.md) | No | Floating IP for VPN endpoint |
| `database` | `string` | No | Reference to database cluster name |
| `vpn_subnet` | `string` | No | VPN network subnet |
| `oidc_enforced` | `true` | Yes | OIDC authentication (always enforced) |

## Configuration Example

```yaml
vpn:
  enabled: true
  type: headscale
  deployment: vm
  vm_ids: [100, 101]
  public_ip:
    ip: "203.0.113.10"
    vrrp_id: 10
  database: core-cluster
  vpn_subnet: "100.64.0.0/10"
  oidc_enforced: true
```

## VM ID Range

Headscale VMs must use IDs in the **BASTION** range:

| Range | Min | Max | Description |
|-------|-----|-----|-------------|
| BASTION | 100 | 149 | Headscale, WireGuard |

## Features

### Zero-Trust Access
- All connections require OIDC authentication via Keycloak
- No implicit trust, every device must be authenticated
- Granular ACL policies per user/group

### High Availability
- Active-passive setup with shared PostgreSQL database
- Automatic failover via keepalived
- Session state preserved across failovers

### Integration
- Native Tailscale client support
- OIDC integration with Keycloak
- ACL policies synced from IAM groups

## Related Documentation

- [VPNConfig Type Reference](../08-reference/types/VPNConfig.md)
- [Security Model](../02-architecture/security-model.md)
- [Keycloak IAM](./keycloak-iam.md)
