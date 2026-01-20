---
id: firewall-config
title: FirewallConfig
sidebar_position: 42
---

# FirewallConfig

Configuration du firewall VyOS ou OPNsense.

## Structure

```yaml
# Dans networking.yaml
firewall:
  enabled: true
  type: vyos                         # vyos, opnsense ou pfsense
  deployment: vm
  vm_ids: [10, 11]
  public_ip:                         # optionnel
    ip: "203.0.113.1"
    vrrp_id: 1
  domain: fw.example.com             # optionnel
```

## Propriétés

| Propriété | Type | Requis | Description |
|-----------|------|--------|-------------|
| `enabled` | booléen | Oui | Activer/désactiver le firewall |
| `type` | `vyos`, `opnsense` ou `pfsense` | Oui | Type de firewall |
| `deployment` | `vm` | Oui | Mode de déploiement (VM uniquement) |
| `vm_ids` | liste de nombres | Oui | IDs des VMs firewall |
| `public_ip` | [FloatingIP](./FloatingIP.md) | Non | IP flottante |
| `domain` | texte | Non | Domaine de management |

## Options de type

| Valeur | Description |
|--------|-------------|
| `vyos` | VyOS router/firewall (recommandé) |
| `opnsense` | OPNsense firewall |
| `pfsense` | pfSense firewall |

## Plage d'ID VM

Les VMs firewall doivent utiliser des IDs dans la plage **FIREWALL** :

| Plage | Min | Max |
|-------|-----|-----|
| FIREWALL | 1 | 49 |

## Configuration HA

Pour le tier production, configurer 2 VMs firewall :

```yaml
firewall:
  enabled: true
  type: vyos
  deployment: vm
  vm_ids: [10, 11]    # Primaire et secondaire
```

Le failover est géré par VRRP entre les deux instances.

## Voir aussi

- [NetworkingConfig](./NetworkingConfig.md)
- [FloatingIP](./FloatingIP.md)
- [PublicIPConfig](./PublicIPConfig.md)
