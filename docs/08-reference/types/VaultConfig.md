---
id: vault-config
title: VaultConfig
sidebar_position: 51
---

# VaultConfig

Configuration de la gestion des secrets OpenBao/Vault.

## Structure

```yaml
# Dans security.yaml
vault:
  enabled: true
  deployment: vm                     # vm ou cluster
  vm_ids: ["150", "151", "152"]      # si deployment: vm
  replicas: 3                        # si deployment: cluster
  storage: postgresql                # postgresql ou raft
  database: core-cluster             # si storage: postgresql
  subdomain: vault                   # optionnel
  accessible_outside_vpn: false      # optionnel
  backup:                            # optionnel
    storage_backend: minio
    schedule: "0 */4 * * *"
    retention:
      daily: 7
      weekly: 4
```

## Propriétés

| Propriété | Type | Requis | Description |
|-----------|------|--------|-------------|
| `enabled` | booléen | Oui | Activer/désactiver Vault |
| `deployment` | `vm` ou `cluster` | Oui | Mode de déploiement |
| `vm_ids` | liste de textes | Non | IDs des VMs (si deployment: vm) |
| `replicas` | nombre | Non | Nombre de réplicas (si deployment: cluster) |
| `storage` | `postgresql` ou `raft` | Oui | Backend de stockage |
| `database` | texte | Non | Référence au cluster DB (si storage: postgresql) |
| `subdomain` | texte | Non | Sous-domaine pour l'UI Vault |
| `accessible_outside_vpn` | booléen | Non | Autoriser l'accès public |
| `backup` | objet | Non | Configuration de backup |

## Options de storage

| Valeur | Description |
|--------|-------------|
| `postgresql` | Backend PostgreSQL (nécessite référence database) |
| `raft` | Stockage Raft intégré |

## Objet backup

| Propriété | Type | Requis | Description |
|-----------|------|--------|-------------|
| `storage_backend` | texte | Oui | Référence au backend de stockage |
| `schedule` | texte | Oui | Expression cron |
| `retention.daily` | nombre | Oui | Jours de rétention quotidienne |
| `retention.weekly` | nombre | Oui | Semaines de rétention hebdomadaire |

## Plage d'ID VM

Les VMs Vault doivent utiliser des IDs dans la plage **SECRETS** :

| Plage | Min | Max |
|-------|-----|-----|
| SECRETS | 150 | 199 |

## Voir aussi

- [SecurityConfig](./SecurityConfig.md)
- [CredentialRef](./CredentialRef.md)
