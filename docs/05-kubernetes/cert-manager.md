# Cert-Manager

Cert-Manager automates TLS certificate issuance and renewal.

## Overview

```
┌─────────────────────────────────────────────────────────────┐
│                 Cert-Manager Architecture                    │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │               Cert-Manager Controller                 │   │
│  │                                                       │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │   │
│  │  │ Certificate │  │   Issuer    │  │   Secret    │   │   │
│  │  │   Request   │──│  (LE/Self)  │──│  (TLS cert) │   │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘   │   │
│  └──────────────────────────────────────────────────────┘   │
│                          │                                   │
│               ┌──────────▼──────────┐                        │
│               │   ACME Challenge    │                        │
│               │  (HTTP-01/DNS-01)   │                        │
│               └─────────────────────┘                        │
│                          │                                   │
│               ┌──────────▼──────────┐                        │
│               │   Let's Encrypt     │                        │
│               │   (or self-signed)  │                        │
│               └─────────────────────┘                        │
└─────────────────────────────────────────────────────────────┘
```

## Schema

Defined by [`CertManagerConfig`](../08-reference/types/CertManagerConfig.md) interface.

## Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `enabled` | `boolean` | Yes | Enable cert-manager |
| `email` | `string` | Yes | Email for Let's Encrypt |
| `production` | `boolean` | Yes | Use production LE server |

## Configuration Example

```yaml
security:
  cert_manager:
    enabled: true
    email: admin@example.com
    production: true
```

## Features

### Issuers
- Let's Encrypt (staging/production)
- Self-signed for internal services
- Private CA integration

### Challenge Types
- HTTP-01 (via Traefik)
- DNS-01 (via PowerDNS API)

### Automation
- Automatic certificate renewal
- Certificate rotation
- Expiry alerts

## Related Documentation

- [Security Layer](../03-layers/security.md)
- [Traefik Ingress](./traefik-ingress.md)
- [CertManagerConfig Type Reference](../08-reference/types/CertManagerConfig.md)
