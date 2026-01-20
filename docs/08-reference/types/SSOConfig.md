---
id: sso-config
title: SSOConfig
sidebar_position: 50
---

# SSOConfig

Configuration SSO/IAM pour Keycloak ou Authentik.

## Structure

```yaml
# Dans security.yaml
sso:
  enabled: true
  type: keycloak                     # keycloak ou authentik
  deployment: vm                     # vm ou cluster
  vm_ids: ["200", "201"]             # si deployment: vm
  replicas: 2                        # si deployment: cluster
  database: core-cluster
  subdomain: auth                    # optionnel
  accessible_outside_vpn: true       # optionnel
```

## Propriétés

| Propriété | Type | Requis | Description |
|-----------|------|--------|-------------|
| `enabled` | booléen | Oui | Activer/désactiver le SSO |
| `type` | `keycloak` ou `authentik` | Oui | Provider SSO |
| `deployment` | `vm` ou `cluster` | Oui | Mode de déploiement |
| `vm_ids` | liste de textes | Non | IDs des VMs (si deployment: vm) |
| `replicas` | nombre | Non | Nombre de réplicas (si deployment: cluster) |
| `database` | texte | Oui | Référence au cluster de base de données |
| `subdomain` | texte | Non | Sous-domaine (ex: "auth") |
| `accessible_outside_vpn` | booléen | Non | Autoriser l'accès public |

## Options de type

| Valeur | Description |
|--------|-------------|
| `keycloak` | Keycloak IAM (recommandé) |
| `authentik` | Authentik identity provider |

## Options de déploiement

| Valeur | Description |
|--------|-------------|
| `vm` | VMs standalone (production) |
| `cluster` | Pods Kubernetes |

## Plage d'ID VM

Les VMs SSO doivent utiliser des IDs dans la plage **IAM_SSO** :

| Plage | Min | Max |
|-------|-----|-----|
| IAM_SSO | 200 | 249 |

## Voir aussi

- [SecurityConfig](./SecurityConfig.md)
- [DatabaseCluster](./DatabaseCluster.md)
