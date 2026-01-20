---
id: why-software-mesh
title: Why software mesh
sidebar_position: 3
---

# 🛡️ Pourquoi l'architecture SoverStack ?

Dans la conception de **SoverStack**, nous avons fait un choix radical : l'indépendance totale vis-à-vis des infrastructures réseaux des hébergeurs. Contrairement aux solutions classiques, nous n'utilisons pas les vSwitchs (Hetzner) ou vRacks (OVH) propriétaires.

Ce document détaille les raisons techniques et stratégiques de ce choix, centré sur la **liberté** et la **sécurité**.

---

## 1. Sortir de la "Prison Dorée" des Hébergeurs

Les solutions comme le **vSwitch** ou le **vRack** sont ce qu'on appelle des "Prisons Dorées".

- **Le Piège :** Elles sont optimisées matériellement (zéro CPU), mais elles vous enchaînent à un seul fournisseur. Si votre réseau privé repose sur le vSwitch Hetzner, vous ne pouvez pas ajouter un serveur chez un autre prestataire ou dans votre propre datacenter pour créer un cluster hybride.
- **La Solution SoverStack :** En utilisant un **Mesh Software-Defined (Tailscale/WireGuard)**, le réseau appartient à la stack, pas à l'hébergeur. SoverStack peut ainsi unifier des serveurs situés n'importe où dans le monde comme s'ils étaient dans la même baie.

---

## 2. Le Chiffrement "Zero-Trust" vs Isolation Simple

Il existe une confusion majeure entre **isolation** et **chiffrement**.

- **vSwitch / vRack :** Ils isolent votre trafic (Layer 2 isolation). C'est comme avoir un tuyau séparé dans une canalisation commune. Mais les données circulent souvent **en clair** à l'intérieur. Un accès physique au réseau de l'hébergeur permet de lire vos données Ceph ou vos bases de données.
- **SoverStack Mesh :** Nous appliquons un chiffrement de bout en bout. Chaque paquet est chiffré par le CPU de l'hôte source et déchiffré par l'hôte destination. Même l'administrateur du datacenter ne voit que du trafic chiffré illisible.

---

## 3. La "Taxe CPU" : Un investissement, pas une perte

Le reproche habituel du Software-Defined Networking (SDN) est la consommation CPU. Chez **SoverStack**, nous considérons cela comme une **"Taxe de Souveraineté"** nécessaire :

1. **Accélération Matérielle :** Les processeurs modernes (AES-NI, AVX-512) réduisent l'impact du chiffrement à moins de 5-10% de la charge globale, même à haute intensité.
2. **Prédictibilité :** En ne dépendant pas du switch de l'hébergeur, nous évitons les pannes réseaux "fantômes" liées aux infrastructures mutualisées des fournisseurs.
3. **Simplicité du Bootstrap :** Le déploiement est identique partout. L'utilisateur apporte ses serveurs (BYOH), SoverStack installe le tunnel, et le cluster est prêt.

---

## 4. Comparatif Stratégique

| Critère                        | vSwitch / vRack (Hébergeur)         | SoverStack Mesh                |
| ------------------------------ | ----------------------------------- | ------------------------------ |
| **Consommation CPU**           | ✅ 0%                               | ⚠️ 5-10% (Chiffrement)         |
| **Sécurité des données**       | ❌ Isolation simple (souvent clair) | ✅ Chiffrement AES/ChaCha20    |
| **Indépendance (Multi-Cloud)** | ❌ Impossible                       | ✅ Totale                      |
| **Vitesse de déploiement**     | ❌ Dépend du panel hébergeur        | ✅ Instantanée via Script      |
| **Maîtrise du MTU**            | ❌ Imposé par l'hébergeur           | ✅ Configurable par SoverStack |

---

## 5. Conclusion : Le choix de la résilience

Choisir **SoverStack**, c'est accepter d'allouer une petite partie de la puissance de calcul à la protection et à l'unification de son réseau. C'est le prix de la liberté : celui de pouvoir quitter un hébergeur en une heure, de sécuriser ses données contre l'espionnage industriel et de posséder une infrastructure véritablement **agnostique**.

---

### Une question sur l'optimisation réseau ?

Si vous avez besoin de performances extrêmes, SoverStack supporte l'optimisation **Jumbo Frames (MTU 9000)** sur les liaisons compatibles, permettant de retrouver une efficacité CPU proche du natif tout en conservant le chiffrement souverain.

---

**Souhaites-tu que je prépare également un guide technique pour expliquer comment monitorer cette consommation CPU spécifiquement pour Tailscale dans Proxmox ?**
