---
id: vm-eep
title: Why software mesh
sidebar_position: 4
---

# Infrastructure Production-Ready - Guide de Dimensionnement

## Vue d'Ensemble

Ce document définit l'architecture d'infrastructure **Haute Disponibilité (HA)**, **scalable** et **production-proof** pour un environnement bare-metal avec Proxmox et Kubernetes.

---

## Table des Matières

- [Architecture Globale](https://www.google.com/search?q=%23architecture-globale)
- [Analyse de l'Existant](https://www.google.com/search?q=%23analyse-de-lexistant)
- [Manques Critiques](https://www.google.com/search?q=%23manques-critiques)
- [Manques Importants](https://www.google.com/search?q=%23manques-importants)
- [Infrastructure Réseau](https://www.google.com/search?q=%23infrastructure-r%C3%A9seau)
- [Dimensionnement Final](https://www.google.com/search?q=%23dimensionnement-final)
- [Plages d'IDs VM Réservées](https://www.google.com/search?q=%23plages-dids-vm-r%C3%A9serv%C3%A9es)
- [Checklist Production-Ready](https://www.google.com/search?q=%23checklist-production-ready)

---

## Architecture Globale

```text
┌─────────────────────────────────────────────────────────────────┐
│                          EDGE LAYER                             │
├─────────────────────────────────────────────────────────────────┤
│    VyOS-Edge-GW (2x HA)  →  HAProxy-Edge (2x HA)               │
│         ↓ VRRP ↓                    ↓ SNI                       │
├─────────────────────────────────────────────────────────────────┤
│                       ZERO-TRUST LAYER                          │
├─────────────────────────────────────────────────────────────────┤
│    Headscale (2x)  ←→  Keycloak (2x)  ←→  Vault (2x)            │
├─────────────────────────────────────────────────────────────────┤
│                          DNS LAYER                              │
├─────────────────────────────────────────────────────────────────┤
│    dnsdist (2x HA)  →  PowerDNS (2x HA)  →  PostgreSQL          │
├─────────────────────────────────────────────────────────────────┤
│                       KUBERNETES LAYER                          │
├─────────────────────────────────────────────────────────────────┤
│    HAProxy-K8s-API (2x) →  Masters (3x)  →  Workers (3x+)       │
│         ↓                    ↓               ↓                  │
│    Traefik (2x)            etcd (3x)       Workloads            │
├─────────────────────────────────────────────────────────────────┤
│                          DATA LAYER                             │
├─────────────────────────────────────────────────────────────────┤
│    PostgreSQL (3x Patroni)  ←→  Redis (3x Sentinel)             │
├─────────────────────────────────────────────────────────────────┤
│                     OBSERVABILITY LAYER                         │
├─────────────────────────────────────────────────────────────────┤
│    Prometheus (2x)  →  Alertmanager (2x)  →  PagerDuty          │
│    Loki (2x)        →  Grafana (2x)                             │
│    Tempo (2x)       →  Wazuh (2x)                               │
├─────────────────────────────────────────────────────────────────┤
│                         STORAGE LAYER                           │
├─────────────────────────────────────────────────────────────────┤
│    MinIO (3x+ erasure)  →  Off-site Backup (S3 externe)         │
└─────────────────────────────────────────────────────────────────┘

```

---

## Analyse de l'Existant

### Infrastructure Actuelle

| VM                   | Qté | Status HA                |
| -------------------- | --- | ------------------------ |
| **VyOS-Edge-GW**     | 2   | ✅ HA                    |
| **HAProxy-Edge**     | 2   | ✅ HA                    |
| **Headscale-Mesh**   | 2   | ✅ HA                    |
| **Keycloak-SSO**     | 2   | ✅ HA                    |
| **dnsdist-LB**       | 1   | ❌ SPOF                  |
| **PowerDNS-HA**      | 2   | ✅ HA                    |
| **PostgreSQL-HA**    | 3   | ✅ HA                    |
| **Prometheus-HA**    | 2   | ✅ HA                    |
| **Grafana-Loki-HA**  | 2   | ✅ HA                    |
| **Pentest-Scanner**  | 1   | ✅ OK (usage ponctuel)   |
| **Audit-Compliance** | 1   | ✅ OK (usage ponctuel)   |
| **S3-Backup-Node**   | 1   | ❌ SPOF CRITIQUE         |
| **Mgmt-Ansible**     | 1   | ✅ OK (pattern standard) |

---

## Manques Critiques

### 1. Kubernetes Cluster (MAJEUR)

**Problème** : Aucun cluster K8s listé. C'est le cœur de la scalabilité.

- **k8s_masters**: 3 instances | 4 vCPU | 8 Go RAM | 50 Go Disk (Control Plane/etcd)
- **k8s_workers**: 3 instances | 8 vCPU | 32 Go RAM | 100 Go Disk (Workloads)
- **haproxy_k8s**: 2 instances | 2 vCPU | 4 Go RAM | 20 Go Disk (K8s API LB)

### 2. dnsdist-LB (Single Point of Failure)

**Problème** : 1 seule instance = panne totale du DNS en cas de crash.

- **Action** : Passer à 2 instances (HA).

### 3. S3-Backup-Node (SPOF Critique)

**Problème** : MinIO exige 3+ nœuds pour l'erasure coding et la protection des données.

- **Action** : Cluster MinIO de 3 instances minimum.

### 4. Vault - Secrets Management

**Problème** : Aucune gestion centralisée des secrets.

- **Action** : Déploiement de 2 instances Vault en HA.

---

## Manques Importants

- **Redis (Cache & Sessions)** : 3 instances (Sentinel) pour Keycloak et les apps.
- **SIEM & Security** : 2 instances Wazuh Manager + Falco (DaemonSet K8s).
- **Alertmanager** : 2 instances pour le routing et l'escalade des alertes.
- **Distributed Tracing** : 2 instances Tempo (Jaeger compatible).
- **CI/CD Runners** : 2 instances GitLab Runners dédiées.

---

## Infrastructure Réseau

### VLANs Requis

| Réseau              | VLAN | CIDR             | Usage                               |
| ------------------- | ---- | ---------------- | ----------------------------------- |
| **Management**      | 10   | `10.0.1.0/24`    | SSH, Ansible, Proxmox UI, Agents    |
| **Proxmox Cluster** | 20   | `10.0.2.0/24`    | Corosync, Live Migration (MTU 9000) |
| **Storage**         | 30   | `10.0.3.0/24`    | Ceph, MinIO, NFS (MTU 9000)         |
| **K8s Pods**        | -    | `10.244.0.0/16`  | CNI (Cilium/Calico)                 |
| **K8s Services**    | -    | `10.96.0.0/12`   | ClusterIP Services                  |
| **Public**          | -    | `203.0.113.0/27` | IPs publiques (Failover VRRP)       |

---

## Dimensionnement Final

### Tableau Récapitulatif des VMs

| VM                  | Qté | vCPU | RAM   | Disque | Rôle                  | Status   |
| ------------------- | --- | ---- | ----- | ------ | --------------------- | -------- |
| **VyOS-Edge-GW**    | 2   | 8    | 8 Go  | 20 Go  | Routeur HA / Firewall | ✅       |
| **HAProxy-Edge**    | 2   | 4    | 8 Go  | 20 Go  | Load Balancer SNI     | ✅       |
| **Headscale-Mesh**  | 2   | 4    | 8 Go  | 40 Go  | Control Plane Mesh    | ✅       |
| **Keycloak-SSO**    | 2   | 4    | 8 Go  | 40 Go  | IAM / OIDC            | ✅       |
| **Vault-HA**        | 2   | 2    | 4 Go  | 40 Go  | Secrets Management    | 🆕       |
| **dnsdist-LB**      | 2   | 2    | 4 Go  | 20 Go  | Front-end DNS HA      | ⚠️ +1    |
| **PowerDNS-HA**     | 2   | 2    | 4 Go  | 40 Go  | DNS Autoritaire       | ✅       |
| **HAProxy-K8s**     | 2   | 2    | 4 Go  | 20 Go  | K8s API LB            | 🆕       |
| **K8s-Master**      | 3   | 4    | 8 Go  | 50 Go  | Control Plane (etcd)  | 🆕       |
| **K8s-Worker**      | 3   | 8    | 32 Go | 100 Go | Data Plane            | 🆕       |
| **PostgreSQL-HA**   | 3   | 8    | 16 Go | 500 Go | Cluster Patroni       | ⚠️ +Disk |
| **Redis-HA**        | 3   | 2    | 8 Go  | 20 Go  | Cache / Sessions      | 🆕       |
| **Prometheus-HA**   | 2   | 4    | 16 Go | 500 Go | Métriques             | ⚠️ +Disk |
| **Alertmanager-HA** | 2   | 2    | 4 Go  | 20 Go  | Routing Alertes       | 🆕       |
| **Grafana-Loki-HA** | 2   | 4    | 16 Go | 1 To   | Dashboards & Logs     | ⚠️ +Disk |
| **Tempo-HA**        | 2   | 4    | 8 Go  | 200 Go | Tracing               | 🆕       |
| **Wazuh-HA**        | 2   | 4    | 8 Go  | 200 Go | SIEM / IDS            | 🆕       |
| **MinIO-Cluster**   | 3   | 4    | 16 Go | 2 To   | S3 distribué          | ⚠️ +2    |
| **GitLab-Runner**   | 2   | 4    | 8 Go  | 100 Go | Build pipelines       | 🆕       |
| **Pentest/Audit**   | 2   | 4    | 8 Go  | 80 Go  | Sécurité active       | ✅       |
| **Mgmt-Ansible**    | 1   | 2    | 4 Go  | 40 Go  | Bastion               | ✅       |

### Totaux Estimés

- **Total VMs** : 42
- **Total vCPUs** : 166
- **Total RAM** : 396 Go
- **Total Stockage** : ~12 To

---

## Plages d'IDs VM Réservées (Proxmox)

| Plage          | Catégorie      | Exemples                            |
| -------------- | -------------- | ----------------------------------- |
| **1 - 99**     | Firewalls      | VyOS (10, 11)                       |
| **100 - 199**  | Bastion & VPN  | Headscale (100, 101)                |
| **200 - 249**  | IAM / SSO      | Keycloak (200), Vault (210)         |
| **250 - 299**  | Databases      | Postgres (250-252), Redis (260)     |
| **300 - 349**  | Monitoring     | Prometheus (300), Grafana (310)     |
| **350 - 399**  | Logging / SIEM | Loki (350), Wazuh (370)             |
| **400 - 449**  | Load Balancers | HAProxy Edge (400), K8s LB (410)    |
| **450 - 499**  | CI/CD & Misc   | GitLab Runners (450), Ansible (490) |
| **500 - 599**  | K8s Masters    | Masters (500, 501, 502)             |
| **600 - 3000** | K8s Workers    | Workers (600, 601, ...)             |
| **3001+**      | Applications   | Custom workloads                    |

---

## Checklist Production-Ready

### 🛡️ Haute Disponibilité

- [ ] Tous les services critiques en 2+ instances.
- [ ] VRRP configuré pour les IPs publiques.
- [ ] Quorum etcd/Patroni respecté (3 nœuds).
- [ ] MinIO en mode erasure coding.

### 🔒 Sécurité

- [ ] Zero-Trust avec Headscale + Keycloak.
- [ ] Vault pour la gestion des secrets et certificats.
- [ ] Wazuh (SIEM) + Falco (Runtime K8s).
- [ ] Network Policies Kubernetes strictes.

### 📊 Observabilité

- [ ] Stack LGTM (Loki, Grafana, Tempo, Mimir/Prometheus).
- [ ] Alertmanager avec escalade (PagerDuty/Slack).

### 💾 Backup & DR

- [ ] Backup off-site (S3 externe).
- [ ] WAL archiving PostgreSQL activé.
- [ ] Velero pour les sauvegardes de workloads K8s.

---

## Ressources Additionnelles

- [Soverstack Documentation](https://docs.soverstack.io)
- [Proxmox HA Wiki](https://pve.proxmox.com/wiki/High_Availability)
- [Patroni Architecture](https://patroni.readthedocs.io)

Souhaitez-vous que je génère un script d'automatisation Ansible ou Terraform basé sur ce dimensionnement ?

```
Tableau Final Corrigé
┌──────────────┬─────┬──────┬───────┬────────┬────────────────────┐
│      VM      │ Qté │ vCPU │  RAM  │ Disque │    HA Mechanism    │
├──────────────┼─────┼──────┼───────┼────────┼────────────────────┤
│ EDGE         │     │      │       │        │                    │
├──────────────┼─────┼──────┼───────┼────────┼────────────────────┤
│ VyOS-Edge-GW │ 2   │ 8    │ 8 Go  │ 20 Go  │ VRRP               │
├──────────────┼─────┼──────┼───────┼────────┼────────────────────┤
│ HAProxy-Edge │ 2   │ 4    │ 8 Go  │ 20 Go  │ Keepalived         │
├──────────────┼─────┼──────┼───────┼────────┼────────────────────┤
│ ZERO-TRUST   │     │      │       │        │                    │
├──────────────┼─────┼──────┼───────┼────────┼────────────────────┤
│ Headscale    │ 2   │ 4    │ 8 Go  │ 40 Go  │ LB + shared DB     │
├──────────────┼─────┼──────┼───────┼────────┼────────────────────┤
│ Keycloak     │ 2   │ 4    │ 8 Go  │ 40 Go  │ Infinispan cluster │
├──────────────┼─────┼──────┼───────┼────────┼────────────────────┤
│ Vault        │ 2   │ 2    │ 4 Go  │ 40 Go  │ Raft consensus     │
├──────────────┼─────┼──────┼───────┼────────┼────────────────────┤
│ DNS          │     │      │       │        │                    │
├──────────────┼─────┼──────┼───────┼────────┼────────────────────┤
│ dnsdist      │ 2   │ 2    │ 4 Go  │ 20 Go  │ Keepalived         │
├──────────────┼─────┼──────┼───────┼────────┼────────────────────┤
│ PowerDNS     │ 2   │ 2    │ 4 Go  │ 40 Go  │ LB + shared DB     │
├──────────────┼─────┼──────┼───────┼────────┼────────────────────┤
│ KUBERNETES   │     │      │       │        │                    │
├──────────────┼─────┼──────┼───────┼────────┼────────────────────┤
│ HAProxy-K8s  │ 2   │ 2    │ 4 Go  │ 20 Go  │ Keepalived         │
├──────────────┼─────┼──────┼───────┼────────┼────────────────────┤
│ K8s-Master   │ 3   │ 4    │ 8 Go  │ 50 Go  │ etcd Raft          │
├──────────────┼─────┼──────┼───────┼────────┼────────────────────┤
│ K8s-Worker   │ 3   │ 8    │ 32 Go │ 100 Go │ ReplicaSets        │
├──────────────┼─────┼──────┼───────┼────────┼────────────────────┤
│ DATA         │     │      │       │        │                    │
├──────────────┼─────┼──────┼───────┼────────┼────────────────────┤
│ PostgreSQL   │ 3   │ 8    │ 16 Go │ 150 Go │ Patroni + etcd     │
├──────────────┼─────┼──────┼───────┼────────┼────────────────────┤
│ Redis        │ 3   │ 2    │ 8 Go  │ 20 Go  │ Sentinel           │
├──────────────┼─────┼──────┼───────┼────────┼────────────────────┤
│ MONITORING   │     │      │       │        │                    │
├──────────────┼─────┼──────┼───────┼────────┼────────────────────┤
│ Prometheus   │ 2   │ 4    │ 16 Go │ 100 Go │ Dual scrape        │
├──────────────┼─────┼──────┼───────┼────────┼────────────────────┤
│ Alertmanager │ 2   │ 2    │ 4 Go  │ 20 Go  │ Gossip cluster     │
├──────────────┼─────┼──────┼───────┼────────┼────────────────────┤
│ Grafana      │ 2   │ 2    │ 4 Go  │ 20 Go  │ LB + shared DB     │
├──────────────┼─────┼──────┼───────┼────────┼────────────────────┤
│ BACKUP       │     │      │       │        │                    │
├──────────────┼─────┼──────┼───────┼────────┼────────────────────┤
│ MinIO        │ 3   │ 4    │ 8 Go  │ 500 Go │ Erasure coding     │
├──────────────┼─────┼──────┼───────┼────────┼────────────────────┤
│ TOOLS        │     │      │       │        │                    │
├──────────────┼─────┼──────┼───────┼────────┼────────────────────┤
│ Pentest      │ 1   │ 4    │ 8 Go  │ 80 Go  │ -                  │
├──────────────┼─────┼──────┼───────┼────────┼────────────────────┤
│ soverstack      │ 1   │ 2    │ 4 Go  │ 40 Go  │ -                  │
└──────────────┴─────┴──────┴───────┴────────┴────────────────────┘
Logs → Service externe (Grafana Cloud, Datadog, etc.)
```

Thanos Query

```
Tableau Final Corrigé

```
