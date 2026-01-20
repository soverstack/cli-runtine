---
id: cert-manager-config
title: CertManagerConfig
sidebar_position: 52
---

# CertManagerConfig

Configuration de la gestion des certificats.

## Definition

```typescript
export interface CertManagerConfig {
  enabled: boolean;
  email: string;
  production: boolean;
}
```

## Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `enabled` | `boolean` | Yes | Enable/disable cert-manager |
| `email` | `string` | Yes | Email for Let's Encrypt |
| `production` | `boolean` | Yes | Use production LE server |

## Production Flag

| Value | Description |
|-------|-------------|
| `true` | Use Let's Encrypt production (real certificates) |
| `false` | Use Let's Encrypt staging (test certificates) |

## Example

```yaml
security:
  cert_manager:
    enabled: true
    email: admin@example.com
    production: true
```

## Notes

- Staging certificates are not trusted by browsers
- Production has rate limits (50 certs/week/domain)
- Use staging for testing to avoid hitting limits

## Related Types

- [SecurityConfig](./SecurityConfig.md)
