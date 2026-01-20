---
id: kubernetes
title: Kubernetes
sidebar_position: 1
---

# Kubernetes Documentation

This section covers Kubernetes cluster architecture and management.

## Contents

1. [Cluster Architecture](./cluster-architecture.md) - K8s cluster design
2. [Cilium CNI](./cilium-cni.md) - Container networking
3. [Traefik Ingress](./traefik-ingress.md) - Ingress controller
4. [Cert-Manager](./cert-manager.md) - Certificate automation
5. [ArgoCD GitOps](./argocd-gitops.md) - GitOps deployment
6. [Velero Backup](./velero-backup.md) - Cluster backup

## Overview

Soverstack deploys production-ready Kubernetes clusters with:

- HA control plane (3+ masters)
- Cilium CNI with eBPF
- Traefik ingress controller
- MetalLB for LoadBalancer services
- ArgoCD for GitOps
- Velero for backup/restore

## Cluster Architecture

```mermaid
graph TB
    subgraph ControlPlane["Control Plane"]
        M1[Master 1]
        M2[Master 2]
        M3[Master 3]
    end
    
    subgraph Workers["Worker Nodes"]
        W1[Worker 1]
        W2[Worker 2]
        W3[Worker 3]
    end
    
    subgraph Networking["Network Stack"]
        CILIUM[Cilium CNI]
        TRAEFIK[Traefik Ingress]
        METALLB[MetalLB]
    end
    
    M1 <--> M2
    M2 <--> M3
    M1 <--> M3
    
    M1 --> W1
    M2 --> W2
    M3 --> W3
    
    CILIUM --> W1
    CILIUM --> W2
    CILIUM --> W3
```

## Cluster Schema

See [`K8sCluster`](../08-reference/types/K8sCluster.md) for the full type definition.
