---
id: datacenter
title: Datacenter
sidebar_position: 11
---

# Datacenter

Configuration des serveurs physiques Proxmox.

## Structure

```yaml
# datacenter.yaml
name: dc-paris-1

servers:
  - name: pve-1
    id: 1
    ip: 10.0.0.1
    port: 22
    password:
      type: env
      var_name: PVE1_PASSWORD
    os: proxmox
    is_gpu_server: false             # optionnel
    description:                     # optionnel
      cpu: 2
      cores: 32
      disks:
        - type: nvme
          size: 1000
        - type: ssd
          size: 2000
    disk_encryption:
      enabled: true
      password:
        type: vault
        path: secret/encryption/pve-1

  - name: pve-2
    id: 2
    ip: 10.0.0.2
    ...
```

## Propriétés

| Propriété | Type | Requis | Description |
|-----------|------|--------|-------------|
| `name` | texte | Oui | Nom du datacenter |
| `servers` | liste de Server | Oui | Liste des serveurs physiques |

## Objet Server

| Propriété | Type | Requis | Description |
|-----------|------|--------|-------------|
| `name` | texte | Oui | Hostname unique du serveur |
| `id` | nombre | Oui | ID du serveur |
| `ip` | texte | Oui | Adresse IP de management |
| `port` | nombre | Oui | Port SSH |
| `password` | [CredentialRef](./CredentialRef.md) | Oui | Référence du mot de passe root |
| `is_gpu_server` | booléen | Non | Serveur avec GPU passthrough |
| `os` | `ubuntu`, `debian`, `rescue` ou `proxmox` | Oui | Système d'exploitation |
| `description` | [ServerDescriptionType](./ServerDescriptionType.md) | Non | Specs matérielles |
| `disk_encryption` | objet | Oui | Configuration du chiffrement |

## Objet disk_encryption

| Propriété | Type | Requis | Description |
|-----------|------|--------|-------------|
| `enabled` | booléen | Oui | Activer le chiffrement LUKS |
| `password` | [CredentialRef](./CredentialRef.md) | Oui | Mot de passe de chiffrement |

## Voir aussi

- [CredentialRef](./CredentialRef.md)
- [ServerDescriptionType](./ServerDescriptionType.md)
