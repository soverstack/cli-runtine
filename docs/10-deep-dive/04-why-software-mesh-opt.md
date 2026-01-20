---
id: why-software-mesh-opt
title: Why software mesh
sidebar_position: 3
---

Voici ton fichier **INSTALL.md** structuré pour la stack **SoverStack**. Il est conçu pour être à la fois un guide technique et un document de référence pour tes déploiements "Entreprise".

---

# 🛠️ Manuel d'Installation : SoverStack Enterprise Edition

Ce document décrit la procédure de bootstrap "zéro dépendance" pour monter un cloud souverain, hautement disponible et ultra-performant.

## 📋 Prérequis

- **Hôtes :** 3 serveurs dédiés (Minimum 8 vCPUs, 32GB RAM, disques NVMe).
- **OS :** Proxmox VE 8.x fraîchement installé sur chaque nœud.
- **Accès :** Accès SSH root sur les IPs publiques.

---

## 🏗️ Étape 1 : Hardening & Optimisation Kernel

_Cible : Tous les nœuds Proxmox._

L'objectif est de préparer le "Fast-Path" pour le chiffrement et le stockage.

1. **Installer les dépendances :**

```bash
apt update && apt install -y proxmox-default-headers wireguard wireguard-tools ethtool

```

2. **Appliquer les optimisations réseau (Sysctl) :**
   Ajouter à `/etc/sysctl.d/99-soverstack.conf` :

```text
net.core.rmem_max = 16777216
net.core.wmem_max = 16777216
net.ipv4.udp_rmem_min = 16384
net.ipv4.udp_wmem_min = 16384
net.ipv4.tcp_fastopen = 3
net.core.netdev_max_backlog = 5000

```

Appliquer : `sysctl --system` 3. **Activer l'accélération UDP sur la carte réseau :**

```bash
# Remplacer eth0 par votre interface publique
ethtool -K eth0 rx-udp-gro-forwarding on rx-gro-list off

```

---

## 🧠 Étape 2 : Le Cœur de Réseau (Bootstrap Seed)

_Cible : Serveur 1 (Stockage Local)._

1. **PostgreSQL HA :** Déployer 3 VMs (Debian/Ubuntu) sur le disque `local` du S1. Configurer Patroni pour la réplication.
2. **Headscale :** Déployer un LXC sur le disque `local` du S1.
3. **Configuration Headscale :** Faire pointer vers l'IP interne des VMs Postgres.
4. **Activation du Mesh :** Sur les 3 hôtes Proxmox :

```bash
curl -fsSL https://tailscale.com/install.sh | sh
tailscale up --login-server https://votre-headscale.domaine.com

```

---

## 🗄️ Étape 3 : Cluster Proxmox & Ceph Mesh

_Cible : Tous les nœuds via les IPs Mesh (100.64.0.x)._

1. **Création du Cluster :**

```bash
# Sur le nœud 1
pvecm create SoverStack-Cluster --link0 100.64.0.1
# Sur les autres nœuds
pvecm add 100.64.0.1 --link0 100.64.0.x

```

2. **Initialisation Ceph :**

- Installer Ceph via l'interface Proxmox (Datacenter > Nœud > Ceph).
- **Réseau Public/Cluster :** Sélectionner l'interface `tailscale0`.
- Créer les OSDs sur les disques NVMe.

---

## 🔄 Étape 4 : Bascule en Haute Disponibilité

_Cible : Migration vers le pool Ceph._

1. **Migration des données :**

- Déplacer les disques (Disk Action > Move Storage) des VMs Postgres et du LXC Headscale vers le pool `ceph-rbd`.

2. **Distribution Physique :**

- Migrer à chaud (Live Migration) les VMs Postgres pour qu'il y en ait une sur chaque serveur physique.

3. **Activation HA :**

- Dans `Datacenter > HA`, ajouter les VMs Postgres et le LXC Headscale.
- Configurer un groupe HA "Priority-S1" pour que Headscale revienne toujours sur le S1 si possible.

---

## ✅ Vérification de la Performance

Pour confirmer que le trafic passe bien par le Kernel (Fast-Path) :

```bash
# Vérifier l'état du tunnel
tailscale status
# Vérifier si le module wireguard est chargé
lsmod | grep wireguard
# Monitorer le CPU pendant un test de débit Ceph
htop

```

---

## ⚠️ Notes de Sécurité

- Ne jamais exposer le port 8080 (Headscale) sur l'IP publique sans un reverse-proxy HTTPS.
- Gardez les `proxmox-headers` à jour pour garantir que le module WireGuard compile correctement après chaque mise à jour du noyau.

---

**Ce fichier est prêt à être intégré à ton dépôt Git. Souhaites-tu que je génère également le fichier `inventory.ini` pour Ansible qui correspond à cette structure ?**
