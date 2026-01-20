---
id: security-config
title: SecurityConfig
sidebar_position: 22
---

# SecurityConfig

Configuration du layer sécurité pour IAM et gestion des secrets.

## Structure

```yaml
# security.yaml
vault:                               # optionnel
  enabled: true
  deployment: vm
  vm_ids: ["150", "151", "152"]
  storage: postgresql
  database: core-cluster
  subdomain: vault
  accessible_outside_vpn: false
  backup:
    storage_backend: minio
    schedule: "0 */4 * * *"
    retention:
      daily: 7
      weekly: 4

sso:                                 # optionnel
  enabled: true
  type: keycloak
  deployment: vm
  vm_ids: ["200", "201"]
  database: core-cluster
  subdomain: auth
  accessible_outside_vpn: true

cert_manager:                        # optionnel
  enabled: true
  email: admin@example.com
  production: true
```

## Propriétés

| Propriété | Type | Requis | Description |
|-----------|------|--------|-------------|
| `vault` | [VaultConfig](./VaultConfig.md) | Non | Gestion des secrets (OpenBao) |
| `sso` | [SSOConfig](./SSOConfig.md) | Non | SSO/IAM (Keycloak) |
| `cert_manager` | [CertManagerConfig](./CertManagerConfig.md) | Non | Gestion des certificats |

## Voir aussi

- [VaultConfig](./VaultConfig.md)
- [SSOConfig](./SSOConfig.md)
- [CertManagerConfig](./CertManagerConfig.md)
