# Infrastructure Requirements

Hardware and software requirements by infrastructure tier.

## Overview

Soverstack supports three infrastructure tiers with different requirements.

## Tier Comparison

| Requirement | Local | Production | Enterprise |
|-------------|-------|------------|------------|
| Min Servers | 1 | 3 | 3 |
| Min DB Nodes | 1 | 3 | 3 |
| Min K8s Masters | 1 | 3 | 3 |
| Min K8s Workers | 1 | 2 | 3 |
| Min Firewall VMs | 1 | 2 | 2 |
| Min VPN VMs | 1 | 2 | 2 |
| HA Required | No | Yes | Yes |

## TypeScript Definition

```typescript
export const HA_REQUIREMENTS = {
  local: {
    min_servers: 1,
    min_db_nodes: 1,
    min_k8s_masters: 1,
    min_k8s_workers: 1,
    min_firewall_vms: 1,
    min_vpn_vms: 1,
    ha_required: false,
  },
  production: {
    min_servers: 3,
    min_db_nodes: 3,
    min_k8s_masters: 3,
    min_k8s_workers: 2,
    min_firewall_vms: 2,
    min_vpn_vms: 2,
    ha_required: true,
  },
  enterprise: {
    min_servers: 3,
    min_db_nodes: 3,
    min_k8s_masters: 3,
    min_k8s_workers: 3,
    min_firewall_vms: 2,
    min_vpn_vms: 2,
    ha_required: true,
  },
} as const;
```

## Hardware Specifications

### Local Tier

Single server development environment.

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| CPU | 8 cores | 16 cores |
| RAM | 32 GB | 64 GB |
| Storage | 500 GB SSD | 1 TB NVMe |
| Network | 1 Gbps | 10 Gbps |

### Production Tier

3-node HA cluster.

| Component | Per Node Min | Per Node Recommended |
|-----------|--------------|----------------------|
| CPU | 16 cores | 32 cores |
| RAM | 64 GB | 128 GB |
| Storage | 1 TB NVMe | 2 TB NVMe + HDD |
| Network | 10 Gbps | 25 Gbps |

### Enterprise Tier

3+ node HA cluster with compliance features.

| Component | Per Node Min | Per Node Recommended |
|-----------|--------------|----------------------|
| CPU | 32 cores | 64 cores |
| RAM | 128 GB | 256 GB |
| Storage | 2 TB NVMe | 4 TB NVMe + HDD |
| Network | 25 Gbps | 100 Gbps |

## Software Requirements

### Proxmox VE

| Component | Version |
|-----------|---------|
| Proxmox VE | 8.0+ |
| Kernel | 6.2+ |

### Operating Systems

| OS | Supported Versions |
|----|-------------------|
| Debian | 12 (Bookworm) |
| Ubuntu | 20.04, 24.04 LTS |

### Kubernetes

| Component | Version |
|-----------|---------|
| Kubernetes | 1.28+ |
| Cilium CNI | 1.14+ |
| Traefik | 3.0+ |

## Related Documentation

- [Infrastructure Tiers](../02-architecture/infrastructure-tiers.md)
- [Datacenter Layer](../03-layers/datacenter.md)
- [Prerequisites](../01-getting-started/prerequisites.md)
