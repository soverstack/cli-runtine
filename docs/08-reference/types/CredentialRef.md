---
id: credential-ref
title: CredentialRef
sidebar_position: 53
---

# CredentialRef

Référence sécurisée pour la gestion des secrets.

## Structure

Trois variantes possibles :

```yaml
# Variante 1: Vault/OpenBao (recommandé pour production)
password:
  type: vault
  path: secret/database/core-cluster

# Variante 2: Variable d'environnement (pour développement)
password:
  type: env
  var_name: DATABASE_PASSWORD

# Variante 3: Fichier (non recommandé)
password:
  type: file
  path: ./secrets/database-password.txt
```

## Variantes

### Référence Vault

Récupère le secret depuis OpenBao/Vault.

| Propriété | Type | Requis | Description |
|-----------|------|--------|-------------|
| `type` | `vault` | Oui | Type de référence |
| `path` | texte | Oui | Chemin du secret dans Vault |

### Variable d'environnement

Lit depuis une variable d'environnement.

| Propriété | Type | Requis | Description |
|-----------|------|--------|-------------|
| `type` | `env` | Oui | Type de référence |
| `var_name` | texte | Oui | Nom de la variable d'environnement |

### Référence fichier

Lit depuis un fichier (non recommandé pour production).

| Propriété | Type | Requis | Description |
|-----------|------|--------|-------------|
| `type` | `file` | Oui | Type de référence |
| `path` | texte | Oui | Chemin du fichier |

## Bonnes pratiques de sécurité

| Priorité | Méthode | Usage |
|----------|---------|-------|
| 1 | `vault` | Production - secrets centralisés et audités |
| 2 | `env` | Développement local |
| 3 | `file` | À éviter - risque de commit dans git |

> **Important** : Ne jamais stocker de mots de passe en clair dans les fichiers YAML.

## Exemples d'utilisation

```yaml
# Dans datacenter.yaml
servers:
  - name: pve-1
    password:
      type: vault
      path: secret/proxmox/pve-1

# Dans databases.yaml
databases:
  - type: postgresql
    credentials:
      type: env
      var_name: POSTGRES_PASSWORD
```

## Voir aussi

- [Datacenter](./Datacenter.md)
- [DatabaseCluster](./DatabaseCluster.md)
- [VaultConfig](./VaultConfig.md)
