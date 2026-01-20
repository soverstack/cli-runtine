---
id: compute-config
title: ComputeConfig
sidebar_position: 12
---

# ComputeConfig

Configuration des machines virtuelles et du layer compute.

## Structure

```yaml
# compute.yaml
instance_type_definitions:
  - name: small
    cpu: 2
    ram: 4096
    disk: 50
    os_template: debian-12-cloudinit
    disk_type: distributed

virtual_machines:
  - name: headscale-1
    vm_id: 100
    host: pve-1
    role: bastion
    type_definition: small

linux_containers:
  - name: container-1
    vm_id: 3001
    ...
```

## Propriétés

| Propriété | Type | Requis | Description |
|-----------|------|--------|-------------|
| `instance_type_definitions` | liste de [ComputeType](./ComputeType.md) | Oui | Templates de taille VM prédéfinis |
| `virtual_machines` | liste de [VMBasedOnType](./VMBasedOnType.md) ou [VMCustom](./VMCustom.md) | Oui | Liste des machines virtuelles |
| `linux_containers` | liste de [VMCustom](./VMCustom.md) | Non | Liste des conteneurs LXC |

## Example

```yaml
instance_type_definitions:
  - name: small
    cpu: 2
    ram: 4096
    disk: 50
    os_template: debian-12-cloudinit
    disk_type: distributed

  - name: medium
    cpu: 4
    ram: 8192
    disk: 100
    os_template: debian-12-cloudinit
    disk_type: distributed

virtual_machines:
  # Using type definition
  - name: headscale-1
    vm_id: 100
    host: pve-1
    role: bastion
    type_definition: small

  # Custom specs
  - name: database-1
    vm_id: 250
    host: pve-1
    role: database
    cpu: 8
    ram: 32768
    disk: 500
    disk_type: distributed
    os_template: debian-12-cloudinit
```

## Types de VM

Les VMs peuvent être définies de deux façons :

### VM basée sur un type (VMBasedOnType)

Référence un [ComputeType](./ComputeType.md) prédéfini par son nom.

| Propriété | Type | Requis | Description |
|-----------|------|--------|-------------|
| `name` | texte | Oui | Nom de la VM |
| `vm_id` | nombre | Oui | ID Proxmox de la VM |
| `host` | texte | Oui | Nœud Proxmox cible |
| `role` | [VMRole](./VMRole.md) | Oui | Rôle de la VM |
| `type_definition` | texte | Oui | Référence au nom du ComputeType |

### VM personnalisée (VMCustom)

Spécification des ressources en ligne.

| Propriété | Type | Requis | Description |
|-----------|------|--------|-------------|
| `name` | texte | Oui | Nom de la VM |
| `vm_id` | nombre | Oui | ID Proxmox de la VM |
| `host` | texte | Oui | Nœud Proxmox cible |
| `role` | [VMRole](./VMRole.md) | Oui | Rôle de la VM |
| `cpu` | nombre | Oui | Nombre de cœurs CPU |
| `ram` | nombre | Oui | RAM en Mo |
| `disk` | nombre | Oui | Disque en Go |
| `disk_type` | `distributed` ou `local` | Oui | Type de stockage |
| `os_template` | texte | Oui | Template OS |

## Voir aussi

- [ComputeType](./ComputeType.md)
- [VMBasedOnType](./VMBasedOnType.md)
- [VMCustom](./VMCustom.md)
- [VMRole](./VMRole.md)
