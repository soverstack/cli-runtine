# Cilium CNI

Cilium provides container networking with eBPF for high performance.

## Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Cilium Architecture                       │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                  Cilium Operator                      │   │
│  │              (Cluster-wide management)                │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │  Cilium  │  │  Cilium  │  │  Cilium  │  │  Cilium  │    │
│  │  Agent   │  │  Agent   │  │  Agent   │  │  Agent   │    │
│  │ (Node 1) │  │ (Node 2) │  │ (Node 3) │  │ (Node N) │    │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘    │
│       │             │             │             │           │
│  ┌────▼─────────────▼─────────────▼─────────────▼────┐     │
│  │                   eBPF Datapath                    │     │
│  │   • L3/L4 Load Balancing                          │     │
│  │   • Network Policy Enforcement                     │     │
│  │   • Transparent Encryption                         │     │
│  └────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

## Configuration

In `cluster.yaml`:

```yaml
network:
  cni: cilium
  cilium_features:
    ebpf_enabled: true
    cluster_mesh: false
```

## Features

### eBPF Datapath
- Kernel-level packet processing
- No iptables overhead
- Native load balancing

### Network Policies
- L3/L4 policies
- L7 policies (HTTP, gRPC)
- DNS-based policies

### Observability
- Hubble flow visibility
- Service mesh integration
- Prometheus metrics

## Cilium Features Configuration

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `ebpf_enabled` | `boolean` | `true` | Enable eBPF datapath |
| `cluster_mesh` | `boolean` | `false` | Enable multi-cluster mesh |

## Related Documentation

- [Cluster Architecture](./cluster-architecture.md)
- [Network Design](../02-architecture/network-design.md)
- [Traefik Ingress](./traefik-ingress.md)
