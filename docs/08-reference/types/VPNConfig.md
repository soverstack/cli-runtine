---
id: vpn-config
title: VPNConfig
sidebar_position: 41
---

# VPNConfig

Configuration VPN pour Headscale ou WireGuard.

## Structure

```yaml
# Dans networking.yaml
vpn:
  enabled: true
  type: headscale                    # headscale, wireguard ou netbird
  deployment: vm
  vm_ids: [100, 101]
  public_ip:                         # optionnel
    ip: "203.0.113.10"
    vrrp_id: 10
  database: core-cluster             # optionnel
  vpn_subnet: "100.64.0.0/10"        # optionnel
  oidc_enforced: true                # toujours true
```

## Propriétés

| Propriété | Type | Requis | Description |
|-----------|------|--------|-------------|
| `enabled` | booléen | Oui | Activer/désactiver le VPN |
| `type` | `headscale`, `wireguard` ou `netbird` | Oui | Type de VPN |
| `deployment` | `vm` | Oui | Mode de déploiement (VM uniquement) |
| `vm_ids` | liste de nombres | Oui | IDs des VMs VPN |
| `public_ip` | [FloatingIP](./FloatingIP.md) | Non | IP flottante pour le VPN |
| `database` | texte | Non | Référence au cluster de base de données |
| `vpn_subnet` | texte | Non | Sous-réseau VPN |
| `oidc_enforced` | `true` | Oui | OIDC toujours activé (non désactivable) |

## Options de type

| Valeur | Description |
|--------|-------------|
| `headscale` | Serveur de contrôle Tailscale open-source (recommandé) |
| `wireguard` | VPN WireGuard |
| `netbird` | VPN NetBird |

## Plage d'ID VM

Les VMs VPN doivent utiliser des IDs dans la plage **BASTION** :

| Plage | Min | Max |
|-------|-----|-----|
| BASTION | 100 | 149 |

## Architecture Zero-Trust

Le VPN Headscale est intégré avec Keycloak pour l'authentification OIDC :

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Client    │────▶│  Headscale  │────▶│  Keycloak   │
│  Tailscale  │     │   (VPN)     │     │   (OIDC)    │
└─────────────┘     └─────────────┘     └─────────────┘
```

## Voir aussi

- [NetworkingConfig](./NetworkingConfig.md)
- [FloatingIP](./FloatingIP.md)
- [SSOConfig](./SSOConfig.md)
