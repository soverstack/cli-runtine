---
id: prerequisites
title: Prerequisites
sidebar_position: 2
---

# Prerequisites

Before installing Soverstack, ensure you meet the following requirements.

## Hardware Requirements

### Minimum (Local/Development)

| Component | Requirement |
|-----------|-------------|
| Servers | 1 Proxmox VE server |
| CPU | 8 cores |
| RAM | 32 GB |
| Storage | 500 GB SSD |
| Network | 1 Gbps |

### Recommended (Production)

| Component | Requirement |
|-----------|-------------|
| Servers | 3+ Proxmox VE servers |
| CPU | 16+ cores per server |
| RAM | 64+ GB per server |
| Storage | NVMe SSDs + Ceph cluster |
| Network | 10 Gbps + dedicated VLANs |

### Enterprise

| Component | Requirement |
|-----------|-------------|
| Servers | 5+ Proxmox VE servers |
| CPU | 32+ cores per server |
| RAM | 128+ GB per server |
| Storage | NVMe SSDs + Ceph with SSD cache |
| Network | 25 Gbps + redundant switches |

## Software Requirements

### Local Machine

| Software | Version | Purpose |
|----------|---------|---------|
| Node.js | 18+ | CLI runtime |
| Git | 2.x | Version control |
| SSH client | Any | Server access |

### Proxmox Servers

| Software | Version | Purpose |
|----------|---------|---------|
| Proxmox VE | 8.x | Hypervisor |
| Ceph | Quincy+ | Distributed storage (optional) |

## Network Requirements

### VLANs (Recommended)

| VLAN | Purpose | Example Subnet |
|------|---------|----------------|
| Management | Proxmox management | 10.0.0.0/24 |
| Cluster | PVE cluster sync | 10.0.1.0/24 |
| Ceph Public | Ceph client traffic | 10.0.2.0/24 |
| Ceph Private | Ceph replication | 10.0.3.0/24 |
| Public | External services | 203.0.113.0/28 |
| Kubernetes | K8s pod/service | 10.244.0.0/16 |

### Firewall Ports

| Port | Protocol | Service |
|------|----------|---------|
| 22 | TCP | SSH |
| 8006 | TCP | Proxmox Web UI |
| 443 | TCP | HTTPS services |
| 6443 | TCP | Kubernetes API |
| 41641 | UDP | Headscale VPN |

## Credentials Required

Before starting, prepare:

1. **Proxmox root passwords** for each server
2. **SSH key pair** for automation
3. **Public IP block** from your provider (optional)
4. **Domain name** with DNS access

## Pre-flight Checklist

- [ ] Proxmox VE installed on all servers
- [ ] Network connectivity between servers
- [ ] SSH access to all servers
- [ ] Public IP block allocated (production)
- [ ] Domain name configured
- [ ] SSL certificates or Let's Encrypt access

## Next Steps

Continue to [Installation](./installation.md).
