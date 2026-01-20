---
id: infrastructure-tier-type
title: InfrastructureTierType
sidebar_position: 80
---

# InfrastructureTierType

Énumération des tiers d'infrastructure.

## Valeurs possibles

| Valeur | Description | HA requis |
|--------|-------------|-----------|
| `local` | Environnement de développement/test | Non |
| `production` | Workloads de production | Oui |
| `enterprise` | Enterprise avec compliance | Oui |

## Exigences par tier

| Exigence | local | production | enterprise |
|----------|-------|------------|------------|
| Serveurs min | 1 | 3 | 3 |
| Nœuds DB min | 1 | 3 | 3 |
| Masters K8s min | 1 | 3 | 3 |
| Workers K8s min | 1 | 2 | 3 |
| VMs Firewall min | 1 | 2 | 2 |
| VMs VPN min | 1 | 2 | 2 |

## Utilisation

```yaml
# platform.yaml
project_name: my-project
infrastructure_tier: production    # local, production ou enterprise
```

## Validation

Soverstack valide que votre configuration respecte les exigences du tier :

```
ERREUR: Le tier production nécessite minimum 3 nœuds de base de données, trouvé 1
```

## Voir aussi

- [Platform](./Platform.md)
- [Documentation Infrastructure Requirements](../infrastructure-requirements.md)
