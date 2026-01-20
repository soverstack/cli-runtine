---
id: database-cluster
title: DatabaseCluster
sidebar_position: 21
---

# DatabaseCluster

Configuration d'un cluster PostgreSQL.

## Structure

```yaml
# databases.yaml
databases:
  - type: postgresql
    version: "16"

    cluster:
      name: core-cluster
      ha: true
      vm_ids: [250, 251, 252]
      read_replicas_vm_ids: [253]    # optionnel

    port: 5432                        # optionnel, défaut: 5432
    ssl: required

    databases:
      - name: keycloak
        owner: keycloak
      - name: headscale
        owner: headscale

    credentials:
      type: vault
      path: secret/database/core-cluster

    backup:                           # optionnel
      storage_backend: minio
      schedule: "0 2 * * *"
      retention:
        daily: 7
        weekly: 4
        monthly: 3
      type: wal_archive
```

## Propriétés

| Propriété | Type | Requis | Description |
|-----------|------|--------|-------------|
| `type` | `postgresql` | Oui | Type de base de données |
| `version` | `14`, `15` ou `16` | Oui | Version PostgreSQL |
| `cluster` | objet | Oui | Configuration du cluster |
| `port` | nombre | Non | Port (défaut: 5432) |
| `ssl` | `required`, `preferred` ou `disabled` | Oui | Mode SSL |
| `databases` | liste de [DatabaseDefinition](./DatabaseDefinition.md) | Oui | Bases à créer |
| `credentials` | [CredentialRef](./CredentialRef.md) | Oui | Référence des credentials |
| `backup` | objet | Non | Configuration de backup |

## Objet cluster

| Propriété | Type | Requis | Description |
|-----------|------|--------|-------------|
| `name` | texte | Oui | Nom du cluster |
| `ha` | booléen | Oui | Activer la haute disponibilité |
| `vm_ids` | liste de nombres | Oui | IDs des VMs du cluster |
| `read_replicas_vm_ids` | liste de nombres | Non | IDs des réplicas en lecture |

## Options SSL

| Valeur | Description |
|--------|-------------|
| `required` | SSL obligatoire |
| `preferred` | SSL préféré mais pas obligatoire |
| `disabled` | SSL désactivé |

## Objet backup

| Propriété | Type | Requis | Description |
|-----------|------|--------|-------------|
| `storage_backend` | texte | Oui | Référence au backend de stockage |
| `schedule` | texte | Oui | Expression cron |
| `retention.daily` | nombre | Oui | Jours de rétention quotidienne |
| `retention.weekly` | nombre | Oui | Semaines de rétention hebdomadaire |
| `retention.monthly` | nombre | Oui | Mois de rétention mensuelle |
| `type` | `pg_dumpall` ou `wal_archive` | Oui | Méthode de backup |

## Example

```yaml
databases:
  - type: postgresql
    version: "16"
    cluster:
      name: core-cluster
      ha: true
      vm_ids: [250, 251, 252]
    port: 5432
    ssl: required
    databases:
      - name: keycloak
        owner: keycloak
      - name: headscale
        owner: headscale
    credentials:
      type: vault
      path: secret/database/core-cluster
    backup:
      storage_backend: minio
      schedule: "0 2 * * *"
      retention:
        daily: 7
        weekly: 4
        monthly: 3
      type: wal_archive
```

## Voir aussi

- [DatabaseDefinition](./DatabaseDefinition.md)
- [CredentialRef](./CredentialRef.md)
