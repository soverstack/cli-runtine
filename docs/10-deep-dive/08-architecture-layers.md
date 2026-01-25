# Architecture Layers

Où vit chaque service dans Soverstack: Global, Région, ou Zone.

---

## Principe

```
┌─────────────────────────────────────────────────────────────────┐
│  GLOBAL          Un seul pour toute l'infrastructure            │
├─────────────────────────────────────────────────────────────────┤
│  RÉGION          Un par région (EU, US, Asia)                   │
├─────────────────────────────────────────────────────────────────┤
│  ZONE            Un par datacenter/zone                         │
└─────────────────────────────────────────────────────────────────┘
```

---

## Services par Niveau

### Global (1 seul)

Services partagés par TOUTES les régions. Un seul endpoint.

| Service | Rôle | Pourquoi Global |
|---------|------|-----------------|
| **Orchestrateur** | API Soverstack, PDM | Endpoint unique pour Terraform |
| **Vault** | Secrets | Secrets centralisés, politique unique |
| **Keycloak** | SSO/IAM | Login unique pour tout |
| **Teleport** | Bastion SSH | Accès centralisé, audit unique |
| **Grafana** | Dashboards | Vue globale, query multi-région |
| **Headscale** | VPN mesh | Connecte toutes les zones |
| **PowerDNS** | DNS autoritaire | Zones DNS centralisées |
| **Gitea** | Git repos | Code source unique |
| **Harbor** | Registry | Images Docker centralisées |

### Par Région (EU, US, Asia)

Services qui collectent des données locales. Évite la latence cross-océan.

| Service | Rôle | Pourquoi Région |
|---------|------|-----------------|
| **Prometheus** | Métriques | Scrape local (pas de latence) |
| **Loki** | Logs | Stockage logs local |
| **Wazuh** | SIEM | Analyse sécurité locale |
| **Alertmanager** | Alertes | Routing alertes local |

### Par Zone (datacenter)

Services liés au hardware physique et aux IPs.

| Service | Rôle | Pourquoi Zone |
|---------|------|---------------|
| **VyOS** | Firewall | Chaque DC a ses IPs |
| **HAProxy** | Load Balancer | Ingress local |
| **IPs publiques** | Bloc IP | Provider = par DC |
| **Ceph** | Storage | Disques locaux |

---

## Flow Observability

```
                         GLOBAL
                    ┌─────────────┐
                    │   GRAFANA   │  ← Dashboard unique
                    │             │    Query toutes régions
                    └──────┬──────┘
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                 │
         ▼                 ▼                 ▼
    ┌─────────┐       ┌─────────┐       ┌─────────┐
    │Prometheus│      │Prometheus│      │Prometheus│
    │   EU    │       │   US    │       │  Asia   │
    └────┬────┘       └────┬────┘       └────┬────┘
         │                 │                 │
    Scrape EU         Scrape US        Scrape Asia
    VMs/K8s           VMs/K8s          VMs/K8s
```

**Pourquoi?**
- Prometheus EU scrape les VMs EU → pas de latence
- Grafana (global) query Prometheus EU + US + Asia → vue unifiée
- Si région US tombe, EU continue de fonctionner

---

## Flow Security

```
                         GLOBAL
                    ┌─────────────┐
                    │   KEYCLOAK  │  ← SSO unique
                    │             │    Tous users/groupes
                    └──────┬──────┘
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                 │
         ▼                 ▼                 ▼
    Region EU         Region US         Region Asia
    ┌─────────┐       ┌─────────┐       ┌─────────┐
    │ Proxmox │       │ Proxmox │       │ Proxmox │
    │ Grafana │       │ Apps    │       │ Apps    │
    │ Vault   │       │ etc.    │       │ etc.    │
    └─────────┘       └─────────┘       └─────────┘
         │                 │                 │
         └─────────────────┴─────────────────┘
                           │
                    Auth via Keycloak
```

---

## Flow Networking

```
                         GLOBAL
                    ┌─────────────┐
                    │  HEADSCALE  │  ← VPN mesh
                    │             │    Connecte tout
                    └──────┬──────┘
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                 │
         ▼                 ▼                 ▼
    Zone EU-Main      Zone US-East      Zone Asia-Tokyo
    ┌─────────┐       ┌─────────┐       ┌─────────┐
    │  VyOS   │◄─────►│  VyOS   │◄─────►│  VyOS   │
    │         │  VPN  │         │  VPN  │         │
    │ HAProxy │       │ HAProxy │       │ HAProxy │
    │         │       │         │       │         │
    │IPs: /27 │       │IPs: /27 │       │IPs: /27 │
    └─────────┘       └─────────┘       └─────────┘
```

**Chaque zone a:**
- Son propre VyOS (firewall)
- Son propre HAProxy (ingress)
- Son propre bloc d'IPs (du provider local)

**Global:**
- Headscale connecte toutes les zones en mesh privé
- PowerDNS gère les zones DNS

---

## Décision: Global vs Région vs Zone

```
┌────────────────────────────────────────────────────────────────┐
│                                                                │
│   "Est-ce que ce service DOIT être unique?"                    │
│                                                                │
│   OUI → GLOBAL                                                 │
│   • SSO (Keycloak) - un seul login                            │
│   • Secrets (Vault) - politique unique                        │
│   • Dashboard (Grafana) - vue unifiée                         │
│   • VPN (Headscale) - mesh unique                             │
│                                                                │
│   NON, mais données locales → RÉGION                           │
│   • Métriques (Prometheus) - scrape local                     │
│   • Logs (Loki) - stockage local                              │
│   • SIEM (Wazuh) - analyse locale                             │
│                                                                │
│   NON, lié au hardware → ZONE                                  │
│   • Firewall (VyOS) - IPs physiques                           │
│   • Ingress (HAProxy) - load balancer local                   │
│   • Storage (Ceph) - disques locaux                           │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

---

## Haute Disponibilité

### Services Globaux

Les services globaux tournent physiquement dans UNE région (primaire), mais:
- Réplicas pour HA (3 instances Vault, 3 Keycloak)
- Backup dans le Hub
- Peuvent être répliqués cross-région si critique

```yaml
# Exemple: Vault global avec HA
vault:
  replicas: 3
  deployment:
    region: eu        # Tourne dans EU
    zone: main        # Zone principale

  # Accessible globalement via Headscale VPN
  endpoint: "https://vault.internal.example.com"
```

### Services Régionaux

Chaque région a ses propres instances:

```yaml
# Prometheus EU
prometheus:
  region: eu
  scrape_targets:
    - "eu-main-*"     # Toutes VMs EU
    - "eu-hub-*"      # Hub EU
```

---

## Résumé

| Niveau | Services | Fichiers |
|--------|----------|----------|
| **Global** | Orchestrator, Vault, Keycloak, Teleport, Grafana, Headscale, PowerDNS, Gitea, Harbor | Racine du projet |
| **Région** | Prometheus, Loki, Wazuh, Alertmanager | `regions/{region}/services/` |
| **Zone** | VyOS, HAProxy, IPs, Ceph | `regions/{region}/zones/{zone}/` |
