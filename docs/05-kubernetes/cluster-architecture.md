# Cluster Architecture

Kubernetes cluster design and node configuration.

## Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Kubernetes Cluster Architecture                   │
│                                                                       │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │                     HAProxy Load Balancers                       │ │
│  │  ┌─────────┐  ┌─────────┐                                       │ │
│  │  │ HAProxy │  │ HAProxy │  API Server Load Balancing            │ │
│  │  │   400   │  │   401   │                                       │ │
│  │  └────┬────┘  └────┬────┘                                       │ │
│  └───────┼────────────┼─────────────────────────────────────────────┘ │
│          │            │                                               │
│  ┌───────▼────────────▼─────────────────────────────────────────────┐ │
│  │                     Control Plane (Masters)                       │ │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐                           │ │
│  │  │ Master  │  │ Master  │  │ Master  │  HA control plane         │ │
│  │  │   500   │  │   501   │  │   502   │                           │ │
│  │  └─────────┘  └─────────┘  └─────────┘                           │ │
│  └───────────────────────────────────────────────────────────────────┘ │
│                                                                       │
│  ┌───────────────────────────────────────────────────────────────────┐ │
│  │                      Data Plane (Workers)                         │ │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐              │ │
│  │  │ Worker  │  │ Worker  │  │ Worker  │  │ Worker  │  Scalable    │ │
│  │  │   600   │  │   601   │  │   602   │  │   ...   │              │ │
│  │  └─────────┘  └─────────┘  └─────────┘  └─────────┘              │ │
│  └───────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

## Schema

Defined by [`K8sCluster`](../08-reference/types/K8sCluster.md) interface.

## Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `name` | `string` | Yes | Cluster name |
| `public_ip` | [`FloatingIP`](../08-reference/types/FloatingIP.md) | No | Floating IP for ingress |
| `ingress` | `object` | No | Ingress controller config |
| `metallb` | `object` | No | MetalLB configuration |
| `ha_proxy_nodes` | `array` | Yes | HAProxy VM definitions |
| `master_nodes` | `array` | Yes | Master node definitions |
| `worker_nodes` | `array` | Yes | Worker node definitions |
| `network` | `object` | No | Network configuration |
| `auto_scaling` | `object` | No | Auto-scaling configuration |

## VM ID Ranges

| Role | Range | Description |
|------|-------|-------------|
| LOAD_BALANCER | 400-449 | HAProxy for K8s API |
| K8S_MASTER | 500-599 | Control plane nodes |
| K8S_WORKER | 600-3000 | Worker nodes |

## Node Configuration

### Master Nodes

```yaml
master_nodes:
  - name: master-1
    vm_id: 500
  - name: master-2
    vm_id: 501
  - name: master-3
    vm_id: 502
```

### Worker Nodes

```yaml
worker_nodes:
  - name: worker-1
    vm_id: 600
  - name: worker-2
    vm_id: 601
  - name: worker-3
    vm_id: 602
```

## Network Configuration

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `pod_cidr` | `string` | `10.244.0.0/16` | Pod network CIDR |
| `service_cidr` | `string` | `10.96.0.0/12` | Service network CIDR |
| `cni` | `"cilium" \| "calico"` | `cilium` | CNI plugin |
| `cilium_features.ebpf_enabled` | `boolean` | `true` | Enable eBPF datapath |
| `cilium_features.cluster_mesh` | `boolean` | `false` | Enable cluster mesh |

## Related Documentation

- [K8sCluster Type Reference](../08-reference/types/K8sCluster.md)
- [Cluster Layer](../03-layers/cluster.md)
- [Cilium CNI](./cilium-cni.md)
