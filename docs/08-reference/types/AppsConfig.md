---
id: apps-config
title: AppsConfig
sidebar_position: 23
---

# AppsConfig

Configuration du layer applications.

## Structure

```yaml
# apps.yaml
gitlab:
  enabled: true
  deployment: cluster
  replicas: 2
  subdomain: gitlab
  accessible_outside_vpn: false
  database: core-cluster

nextcloud:
  enabled: true
  deployment: cluster
  replicas: 3
  subdomain: cloud
  accessible_outside_vpn: true
  database: core-cluster

wiki:
  enabled: true
  deployment: cluster
  replicas: 2
  subdomain: wiki
  accessible_outside_vpn: false

custom-app:
  enabled: true
  deployment: vm
  vm_ids: ["3001", "3002"]
  subdomain: app
  accessible_outside_vpn: true
```

## Structure de la map

Une map de noms d'applications vers leurs définitions.

## Objet AppDefinition

| Propriété | Type | Requis | Description |
|-----------|------|--------|-------------|
| `enabled` | booléen | Oui | Activer/désactiver l'application |
| `deployment` | `vm` ou `cluster` | Oui | Mode de déploiement |
| `vm_ids` | liste de textes | Non | IDs des VMs (si deployment: vm) |
| `replicas` | nombre | Non | Nombre de réplicas (si deployment: cluster) |
| `subdomain` | texte | Non | Sous-domaine pour l'app |
| `accessible_outside_vpn` | booléen | Non | Autoriser l'accès public |
| `database` | texte | Non | Référence au cluster de base de données |

## Options de déploiement

| Valeur | Description |
|--------|-------------|
| `vm` | VMs standalone |
| `cluster` | Pods Kubernetes |

## Voir aussi

- [Feature](./Feature.md)
- [DatabaseCluster](./DatabaseCluster.md)
