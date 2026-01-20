---
id: vm-role
title: VMRole
sidebar_position: 34
---

# VMRole

Énumération des rôles VM pour la classification et la validation.

## Valeurs possibles

### Edge & Réseau

| Rôle | Plage ID | Description |
|------|----------|-------------|
| `firewall` | 1-49 | VyOS, OPNsense |
| `dns_lb` | 50-69 | dnsdist load balancer |
| `dns_server` | 70-99 | PowerDNS |
| `load_balancer` | 400-449 | HAProxy, Nginx |

### Zero-Trust & Sécurité

| Rôle | Plage ID | Description |
|------|----------|-------------|
| `bastion` | 100-149 | Headscale, WireGuard |
| `secrets` | 150-199 | OpenBao, Vault |
| `iam_sso` | 200-249 | Keycloak, Authentik |

### Données

| Rôle | Plage ID | Description |
|------|----------|-------------|
| `database` | 250-279 | PostgreSQL |
| `cache` | 280-299 | Redis, Valkey |

### Observabilité

| Rôle | Plage ID | Description |
|------|----------|-------------|
| `monitoring` | 300-319 | Prometheus |
| `alerting` | 320-329 | Alertmanager |
| `dashboards` | 330-349 | Grafana |
| `logging` | 350-369 | Loki |
| `siem` | 370-399 | Wazuh, Falco |

### Kubernetes

| Rôle | Plage ID | Description |
|------|----------|-------------|
| `k8s_master` | 500-599 | Nœuds control plane |
| `k8s_worker` | 600-3000 | Nœuds worker |

### Outils

| Rôle | Plage ID | Description |
|------|----------|-------------|
| `pentest` | 450-469 | VM de test de sécurité |
| `management` | 450-469 | Gestion Soverstack |
| `ci_runner` | 470-499 | GitLab runners, PBS |

### Autres

| Rôle | Plage ID | Description |
|------|----------|-------------|
| `general_purpose` | 3001-99999 | Applications custom |
| `template` | - | Templates VM |

## Validation

Les IDs VM sont validés par rapport à leur rôle :

```yaml
# Valide
- name: vyos-1
  vm_id: 10
  role: firewall    # 10 est dans la plage 1-49

# Invalide - échouera à la validation
- name: vyos-1
  vm_id: 500        # 500 est dans la plage K8S_MASTER
  role: firewall    # ERREUR
```

## Voir aussi

- [VMBase](./VMBase.md)
- [VMBasedOnType](./VMBasedOnType.md)
- [VMCustom](./VMCustom.md)
