# Cluster Layer

The cluster layer defines Kubernetes cluster configuration.

## Schema

Defined by [`K8sCluster`](../08-reference/types/K8sCluster.md) interface.

## Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `name` | `string` | ✅ | Cluster name |
| `public_ip` | [`FloatingIP`](../08-reference/types/FloatingIP.md) | ❌ | Ingress public IP |
| `ingress` | [`IngressConfig`](#ingress-config) | ❌ | Ingress controller |
| `metallb` | [`MetalLBConfig`](#metallb-config) | ❌ | MetalLB configuration |
| `ha_proxy_nodes` | [`NodeRef[]`](#node-ref) | ✅ | HAProxy for K8s API |
| `master_nodes` | [`NodeRef[]`](#node-ref) | ✅ | Control plane nodes |
| `worker_nodes` | [`NodeRef[]`](#node-ref) | ✅ | Worker nodes |
| `network` | [`NetworkConfig`](#network-config) | ❌ | Pod/Service networking |
| `auto_scaling` | [`AutoScalingConfig`](#auto-scaling) | ❌ | Cluster auto-scaling |

### Node Ref

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `name` | `string` | ✅ | Node name |
| `vm_id` | `number` | ✅ | Proxmox VM ID |

### Ingress Config

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `type` | `"traefik"` \| `"nginx"` | ✅ | Ingress controller |
| `replicas` | `number` | ✅ | Replica count |
| `dashboard` | `boolean` | ❌ | Enable dashboard |
| `dashboard_subdomain` | `string` | ❌ | Dashboard subdomain |

### MetalLB Config

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `enabled` | `boolean` | ✅ | Enable MetalLB |
| `mode` | `"layer2"` | ✅ | Only layer2 supported |
| `address_pool` | `string` | ✅ | IP range for LoadBalancer |

### Network Config

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `pod_cidr` | `string` | ❌ | Pod network (default: `10.244.0.0/16`) |
| `service_cidr` | `string` | ❌ | Service network (default: `10.96.0.0/12`) |
| `cni` | `"cilium"` \| `"calico"` | ❌ | CNI plugin (default: cilium) |
| `cilium_features` | object | ❌ | Cilium-specific features |
| `cilium_features.ebpf_enabled` | `boolean` | ❌ | Enable eBPF |
| `cilium_features.cluster_mesh` | `boolean` | ❌ | Enable cluster mesh |

### Auto Scaling

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `enabled` | `boolean` | ✅ | Enable auto-scaling |
| `min_nodes` | `number` | ✅ | Minimum worker nodes |
| `max_nodes` | `number` | ✅ | Maximum worker nodes |
| `cpu_utilization_percentage` | `number` | ✅ | Scale threshold |
| `providers` | [`Provider[]`](#provider) | ✅ | Cloud providers |

### Provider

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `type` | `"public_cloud"` \| `"onprem"` | ✅ | Provider type |
| `platform` | `"aws"` \| `"gcp"` \| `"azure"` \| `"onprem"` | ✅ | Platform |
| `priority` | `number` | ✅ | Scaling priority |
| `max_nodes` | `number` | ✅ | Max nodes from provider |
| `region` | `string` | ❌ | Cloud region |
| `resources` | object | ✅ | Node resources |

## Complete Example

```yaml
# layers/cluster.yaml

name: k8s-production

# Public IP for ingress
public_ip:
  ip: "203.0.113.4"
  vrrp_id: 30
  health_check:
    type: tcp
    port: 443

# Ingress controller
ingress:
  type: traefik
  replicas: 2
  dashboard: true
  dashboard_subdomain: traefik

# MetalLB for LoadBalancer services
metallb:
  enabled: true
  mode: layer2
  address_pool: "10.0.40.100-10.0.40.200"

# HAProxy for K8s API HA
ha_proxy_nodes:
  - name: k8s-lb-01
    vm_id: 400
  - name: k8s-lb-02
    vm_id: 401

# Control plane
master_nodes:
  - name: k8s-master-01
    vm_id: 500
  - name: k8s-master-02
    vm_id: 501
  - name: k8s-master-03
    vm_id: 502

# Worker nodes
worker_nodes:
  - name: k8s-worker-01
    vm_id: 600
  - name: k8s-worker-02
    vm_id: 601
  - name: k8s-worker-03
    vm_id: 602

# Network configuration
network:
  pod_cidr: "10.244.0.0/16"
  service_cidr: "10.96.0.0/12"
  cni: cilium
  cilium_features:
    ebpf_enabled: true
    cluster_mesh: false

# Auto-scaling (optional)
auto_scaling:
  enabled: false
  min_nodes: 3
  max_nodes: 10
  cpu_utilization_percentage: 70
  providers: []
```

## VM ID Ranges

| Component | Range | Example IDs |
|-----------|-------|-------------|
| HAProxy (K8s API) | 400-449 | 400, 401 |
| K8s Masters | 500-599 | 500, 501, 502 |
| K8s Workers | 600-3000 | 600, 601, 602, ... |

## HA Requirements

### Control Plane

| Tier | Min Masters | Quorum |
|------|-------------|--------|
| local | 1 | N/A |
| production | 3 | 2 |
| enterprise | 3+ | 2+ |

### Workers

| Tier | Min Workers |
|------|-------------|
| local | 1 |
| production | 2 |
| enterprise | 3 |

## Network Defaults

| Setting | Default | Description |
|---------|---------|-------------|
| `pod_cidr` | `10.244.0.0/16` | Pod IP range |
| `service_cidr` | `10.96.0.0/12` | Service IP range |
| `cni` | `cilium` | CNI plugin |
| `ebpf_enabled` | `true` | eBPF dataplane |

## Validation Rules

| Rule | Tier | Severity |
|------|------|----------|
| Unique node names | All | Critical |
| VM IDs in correct range | All | Error |
| Min 3 masters for HA | Production+ | Critical |
| Min 2 workers | Production+ | Critical |
| Odd number of masters | All | Warning |

## See Also

- [K8sCluster Type](../08-reference/types/K8sCluster.md)
- [Kubernetes Architecture](../05-kubernetes/cluster-architecture.md)
- [Cilium CNI](../05-kubernetes/cilium-cni.md)
- [Traefik Ingress](../05-kubernetes/traefik-ingress.md)
