---
id: k8s-cluster
title: K8sCluster
sidebar_position: 13
---

# K8sCluster

Configuration du cluster Kubernetes.

## Structure

```yaml
# cluster.yaml
name: production

public_ip:                           # optionnel
  ip: "203.0.113.20"
  vrrp_id: 20

ingress:                             # optionnel
  type: traefik
  replicas: 3
  dashboard: true
  dashboard_subdomain: traefik

metallb:                             # optionnel
  enabled: true
  mode: layer2
  address_pool: "203.0.113.100-203.0.113.200"

ha_proxy_nodes:
  - name: haproxy-1
    vm_id: 400
  - name: haproxy-2
    vm_id: 401

master_nodes:
  - name: master-1
    vm_id: 500
  - name: master-2
    vm_id: 501
  - name: master-3
    vm_id: 502

worker_nodes:
  - name: worker-1
    vm_id: 600
  - name: worker-2
    vm_id: 601
  - name: worker-3
    vm_id: 602

network:                             # optionnel
  pod_cidr: "10.244.0.0/16"
  service_cidr: "10.96.0.0/12"
  cni: cilium
  cilium_features:
    ebpf_enabled: true
    cluster_mesh: false
```

## Propriétés

| Propriété | Type | Requis | Description |
|-----------|------|--------|-------------|
| `name` | texte | Oui | Nom du cluster |
| `public_ip` | [FloatingIP](./FloatingIP.md) | Non | IP flottante pour l'ingress |
| `ingress` | objet | Non | Configuration du contrôleur ingress |
| `metallb` | objet | Non | Configuration MetalLB |
| `ha_proxy_nodes` | liste de Node | Oui | Définitions des VMs HAProxy |
| `master_nodes` | liste de Node | Oui | Définitions des nœuds master |
| `worker_nodes` | liste de Node | Oui | Définitions des nœuds worker |
| `network` | objet | Non | Configuration réseau |
| `auto_scaling` | objet | Non | Configuration auto-scaling |

## Objet Node

| Propriété | Type | Requis | Description |
|-----------|------|--------|-------------|
| `name` | texte | Oui | Nom du nœud |
| `vm_id` | nombre | Oui | ID Proxmox de la VM |

## Objet ingress

| Propriété | Type | Requis | Description |
|-----------|------|--------|-------------|
| `type` | `traefik` ou `nginx` | Oui | Type de contrôleur ingress |
| `replicas` | nombre | Oui | Nombre de réplicas |
| `dashboard` | booléen | Non | Activer le dashboard |
| `dashboard_subdomain` | texte | Non | Sous-domaine du dashboard |

## Objet metallb

| Propriété | Type | Requis | Description |
|-----------|------|--------|-------------|
| `enabled` | booléen | Oui | Activer MetalLB |
| `mode` | `layer2` | Oui | Mode MetalLB |
| `address_pool` | texte | Oui | Plage d'adresses IP |

## Objet network

| Propriété | Type | Défaut | Description |
|-----------|------|--------|-------------|
| `pod_cidr` | texte | `10.244.0.0/16` | CIDR réseau des pods |
| `service_cidr` | texte | `10.96.0.0/12` | CIDR réseau des services |
| `cni` | `cilium` ou `calico` | `cilium` | Plugin CNI |
| `cilium_features.ebpf_enabled` | booléen | `true` | Activer eBPF |
| `cilium_features.cluster_mesh` | booléen | `false` | Activer le mesh |

## Plages d'ID VM

| Rôle | Plage | Description |
|------|-------|-------------|
| ha_proxy_nodes | 400-449 | HAProxy pour l'API K8s |
| master_nodes | 500-599 | Control plane |
| worker_nodes | 600-3000 | Data plane |

## Voir aussi

- [FloatingIP](./FloatingIP.md)
- [VMRole](./VMRole.md)
