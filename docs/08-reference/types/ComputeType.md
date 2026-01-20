---
id: compute-type
title: ComputeType
sidebar_position: 33
---

# ComputeType

Définition d'un type d'instance VM.

## Structure

```yaml
# Dans compute.yaml
instance_type_definitions:
  - name: micro
    cpu: 1
    ram: 1024
    disk: 20
    os_template: debian-12-cloudinit
    disk_type: local

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

  - name: large
    cpu: 8
    ram: 16384
    disk: 200
    os_template: debian-12-cloudinit
    disk_type: distributed

  - name: gpu-workload
    cpu: 16
    ram: 65536
    disk: 500
    os_template: ubuntu-24.04-cloudinit
    disk_type: local
    is_gpu_enabled: true
```

## Propriétés

| Propriété | Type | Requis | Description |
|-----------|------|--------|-------------|
| `name` | texte | Oui | Nom unique du type (ex: "small", "high-mem-v1") |
| `cpu` | nombre | Oui | Nombre de cœurs CPU |
| `ram` | nombre | Oui | RAM en Mo |
| `disk` | nombre | Oui | Taille disque en Go |
| `os_template` | texte | Oui | Nom du template OS ou URL |
| `disk_type` | `distributed` ou `local` | Oui | Backend de stockage |
| `is_gpu_enabled` | booléen | Non | Activer le GPU passthrough |

## Options os_template

Templates prédéfinis :
- `debian-12-cloudinit`
- `ubuntu-20.04-cloudinit`
- `ubuntu-24.04-cloudinit`

URLs personnalisées supportées pour les images cloud-init compatibles.

## Options disk_type

| Valeur | Description |
|--------|-------------|
| `distributed` | Stockage Ceph distribué (HA) |
| `local` | Stockage local du nœud (plus rapide) |

## Utilisation

Référencer dans les VMs :

```yaml
virtual_machines:
  - name: web-server
    vm_id: 3001
    host: pve-1
    role: general_purpose
    type_definition: small    # Référence au type "small" ci-dessus
```

## Voir aussi

- [ComputeConfig](./ComputeConfig.md)
- [VMBasedOnType](./VMBasedOnType.md)
