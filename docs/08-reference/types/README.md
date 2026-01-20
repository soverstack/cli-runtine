---
id: types-overview
title: Référence des Types
sidebar_position: 1
---

# Référence des Types

Référence complète de tous les types TypeScript utilisés dans la configuration Soverstack.

## Types Principaux

| Type | Description |
|------|-------------|
| [Platform](./Platform.md) | Configuration principale de la plateforme |
| [Datacenter](./Datacenter.md) | Définition des serveurs physiques |
| [ComputeConfig](./ComputeConfig.md) | Configuration des machines virtuelles |
| [K8sCluster](./K8sCluster.md) | Configuration du cluster Kubernetes |

## Configuration des Layers

| Type | Description |
|------|-------------|
| [NetworkingConfig](./NetworkingConfig.md) | Layer réseau |
| [DatabaseCluster](./DatabaseCluster.md) | Cluster de base de données |
| [SecurityConfig](./SecurityConfig.md) | Services de sécurité |
| [AppsConfig](./AppsConfig.md) | Applications |

## Types VM

| Type | Description |
|------|-------------|
| [VMBase](./VMBase.md) | Propriétés de base des VMs |
| [VMBasedOnType](./VMBasedOnType.md) | VM utilisant un type prédéfini |
| [VMCustom](./VMCustom.md) | VM avec specs personnalisées |
| [ComputeType](./ComputeType.md) | Définition de type d'instance |
| [VMRole](./VMRole.md) | Énumération des rôles VM |

## Types Réseau

| Type | Description |
|------|-------------|
| [DNSConfig](./DNSConfig.md) | Configuration DNS |
| [VPNConfig](./VPNConfig.md) | Configuration VPN |
| [FirewallConfig](./FirewallConfig.md) | Configuration Firewall |
| [FloatingIP](./FloatingIP.md) | Définition IP flottante |
| [PublicIPConfig](./PublicIPConfig.md) | Bloc d'IPs publiques |

## Types Sécurité

| Type | Description |
|------|-------------|
| [SSOConfig](./SSOConfig.md) | Configuration SSO |
| [VaultConfig](./VaultConfig.md) | Gestion des secrets |
| [CertManagerConfig](./CertManagerConfig.md) | Gestion des certificats |
| [CredentialRef](./CredentialRef.md) | Référence de credentials |

## Types Utilitaires

| Type | Description |
|------|-------------|
| [StorageBackend](./StorageBackend.md) | Backend de stockage |
| [Feature](./Feature.md) | Fonctionnalités K8s |
| [DatabaseDefinition](./DatabaseDefinition.md) | Définition de base de données |
| [ServerDescriptionType](./ServerDescriptionType.md) | Description matérielle serveur |

## Types Opérationnels

| Type | Description |
|------|-------------|
| [ValidationResult](./ValidationResult.md) | Résultat de validation |
| [PlanResult](./PlanResult.md) | Résultat du plan |

## Énumérations

| Type | Description |
|------|-------------|
| [InfrastructureTierType](./InfrastructureTierType.md) | Tier d'infrastructure |
| [LayerType](./LayerType.md) | Types de layers |
| [BackendType](./BackendType.md) | Types de backend d'état |

## Plages d'ID VM

Référence rapide des plages d'ID VM par rôle :

| Rôle | Plage | Description |
|------|-------|-------------|
| `firewall` | 1-49 | VyOS, OPNsense, pfSense |
| `dns_lb` | 50-69 | dnsdist |
| `dns_server` | 70-99 | PowerDNS |
| `bastion` | 100-149 | Headscale, WireGuard |
| `secrets` | 150-199 | OpenBao, Vault |
| `iam_sso` | 200-249 | Keycloak, Authentik |
| `database` | 250-279 | PostgreSQL |
| `cache` | 280-299 | Redis, Valkey |
| `monitoring` | 300-319 | Prometheus |
| `alerting` | 320-329 | Alertmanager |
| `dashboards` | 330-349 | Grafana |
| `logging` | 350-369 | Loki |
| `siem` | 370-399 | Wazuh, Falco |
| `ha_proxy` | 400-449 | HAProxy |
| `k8s_master` | 500-599 | Control plane K8s |
| `k8s_worker` | 600-3000 | Workers K8s |
| `general_purpose` | 3001-99999 | Applications custom |
