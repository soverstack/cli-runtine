# ArgoCD GitOps

ArgoCD provides declarative GitOps-based continuous delivery.

## Overview

```
┌─────────────────────────────────────────────────────────────┐
│                   ArgoCD Architecture                        │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                   Git Repository                      │   │
│  │   (Kubernetes manifests, Helm charts, Kustomize)     │   │
│  └──────────────────────────┬───────────────────────────┘   │
│                             │                                │
│                      ┌──────▼──────┐                         │
│                      │   ArgoCD    │                         │
│                      │   Server    │                         │
│                      └──────┬──────┘                         │
│                             │                                │
│  ┌──────────────────────────▼───────────────────────────┐   │
│  │                 Kubernetes Cluster                    │   │
│  │                                                       │   │
│  │   ┌─────────┐  ┌─────────┐  ┌─────────┐              │   │
│  │   │  App 1  │  │  App 2  │  │  App 3  │              │   │
│  │   └─────────┘  └─────────┘  └─────────┘              │   │
│  └───────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Configuration

In `apps.yaml` (Feature):

```yaml
argocd:
  enabled: true
  sub_domains: argocd
  accessible_outside_vpn: false
```

## Features

### GitOps Workflow
- Git as single source of truth
- Automatic sync from repository
- Drift detection and remediation

### Application Management
- Helm chart support
- Kustomize support
- Raw Kubernetes manifests

### Multi-Cluster
- Manage multiple clusters
- Cluster-specific overrides
- Centralized management

### Security
- OIDC integration (Keycloak)
- RBAC policies
- Audit logging

## Sync Strategies

| Strategy | Description |
|----------|-------------|
| Manual | Require manual sync approval |
| Automated | Sync on git changes |
| Self-Heal | Revert manual cluster changes |
| Prune | Delete removed resources |

## Related Documentation

- [Apps Layer](../03-layers/apps.md)
- [Cluster Architecture](./cluster-architecture.md)
- [Keycloak IAM](../04-services/keycloak-iam.md)
