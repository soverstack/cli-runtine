---
id: floating-ip
title: FloatingIP
sidebar_position: 43
---

# FloatingIP

Configuration d'une IP flottante pour les services.

## Structure

```yaml
# IP flottante simple
public_ip:
  ip: "203.0.113.10"
  vrrp_id: 10

# Avec health check
public_ip:
  ip: "203.0.113.20"
  vrrp_id: 20
  health_check:
    type: http
    port: 80
    path: /health
    interval: "5s"
```

## Propriétés

| Propriété | Type | Requis | Description |
|-----------|------|--------|-------------|
| `ip` | texte | Oui | Adresse IP |
| `vrrp_id` | nombre | Oui | ID VRRP (1-255, unique par IP) |
| `health_check` | objet | Non | Configuration du health check |

## Objet health_check

| Propriété | Type | Requis | Description |
|-----------|------|--------|-------------|
| `type` | `tcp` ou `http` | Oui | Type de vérification |
| `port` | nombre | Oui | Port à vérifier |
| `path` | texte | Non | Chemin HTTP (pour les checks HTTP) |
| `interval` | texte | Non | Intervalle de vérification |

## ID VRRP

- Doit être unique par adresse IP
- Plage : 1-255
- Utilisé pour le failover VRRP entre routeurs

## Exemples d'utilisation

```yaml
# Dans cluster.yaml
cluster:
  name: production
  public_ip:
    ip: "203.0.113.20"
    vrrp_id: 20

# Dans networking.yaml
vpn:
  enabled: true
  public_ip:
    ip: "203.0.113.10"
    vrrp_id: 10
```

## Voir aussi

- [PublicIPConfig](./PublicIPConfig.md)
- [K8sCluster](./K8sCluster.md)
- [VPNConfig](./VPNConfig.md)
