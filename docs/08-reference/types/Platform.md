---
id: platform
title: Platform
sidebar_position: 10
---

# Platform

Configuration principale de la plateforme.

## Structure

```yaml
# platform.yaml
project_name: my-infrastructure
version: "1.0.0"
environment: production              # optionnel
domain: example.com
infrastructure_tier: production      # local, production ou enterprise

storage_backends:                    # optionnel
  minio:
    server: backup-server
    type: s3
    endpoint: "10.0.30.1:9000"
    bucket_prefix: "soverstack-"

layers:
  datacenter: ./layers/datacenter.yaml
  networking: ./layers/networking.yaml
  compute: ./layers/compute/compute.yaml
  database: ./layers/databases/databases.yaml
  cluster: ./layers/cluster.yaml
  security: ./layers/security.yaml
  observability: ./layers/observability.yaml
  apps: ./layers/apps.yaml

ssh: ./secrets/ssh/soverstack

state:
  backend: local
  path: ./.soverstack/state
```

## Propriétés

| Propriété | Type | Requis | Description |
|-----------|------|--------|-------------|
| `project_name` | texte | Oui | Identifiant unique du projet |
| `version` | texte | Oui | Version Soverstack |
| `environment` | texte | Non | Nom de l'environnement (dev, staging, prod) |
| `domain` | texte | Oui | Domaine principal pour tous les services |
| `infrastructure_tier` | `local`, `production` ou `enterprise` | Oui | Tier d'infrastructure |
| `storage_backends` | map de [StorageBackend](./StorageBackend.md) | Non | Définitions des backends de stockage |
| `layers` | objet | Oui | Références aux fichiers de layers |
| `ssh` | texte | Oui | Chemin vers la clé SSH |
| `state` | objet | Oui | Configuration du backend d'état |

## Objet layers

| Propriété | Type | Requis | Description |
|-----------|------|--------|-------------|
| `datacenter` | texte | Oui | Chemin vers datacenter.yaml |
| `compute` | texte | Non | Chemin vers compute.yaml |
| `cluster` | texte | Non | Chemin vers cluster.yaml |
| `database` | texte | Non | Chemin vers databases.yaml |
| `networking` | texte | Non | Chemin vers networking.yaml |
| `security` | texte | Non | Chemin vers security.yaml |
| `observability` | texte | Non | Chemin vers observability.yaml |
| `apps` | texte | Non | Chemin vers apps.yaml |

## Objet state

| Propriété | Type | Requis | Description |
|-----------|------|--------|-------------|
| `backend` | `local`, `aws`, `gcr` ou `azure` | Oui | Type de stockage d'état |
| `path` | texte | Oui | Emplacement du fichier d'état |

## Voir aussi

- [InfrastructureTierType](./InfrastructureTierType.md)
- [StorageBackend](./StorageBackend.md)
