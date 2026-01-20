# Traefik Ingress

Traefik provides ingress routing and TLS termination for Kubernetes services.

## Overview

```
┌─────────────────────────────────────────────────────────────┐
│                   Traefik Architecture                       │
│                                                              │
│               ┌─────────────────────┐                        │
│               │    Public IP        │                        │
│               │   (FloatingIP)      │                        │
│               └──────────┬──────────┘                        │
│                          │                                   │
│               ┌──────────▼──────────┐                        │
│               │   MetalLB Service   │                        │
│               │   (LoadBalancer)    │                        │
│               └──────────┬──────────┘                        │
│                          │                                   │
│  ┌───────────────────────▼───────────────────────────┐      │
│  │                 Traefik Pods                       │      │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐            │      │
│  │  │ Traefik │  │ Traefik │  │ Traefik │ HA         │      │
│  │  └─────────┘  └─────────┘  └─────────┘            │      │
│  └───────────────────────────────────────────────────┘      │
│                          │                                   │
│               ┌──────────▼──────────┐                        │
│               │  Backend Services   │                        │
│               │  (ClusterIP)        │                        │
│               └─────────────────────┘                        │
└─────────────────────────────────────────────────────────────┘
```

## Configuration

In `cluster.yaml`:

```yaml
ingress:
  type: traefik
  replicas: 3
  dashboard: true
  dashboard_subdomain: traefik
```

## Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `type` | `"traefik" \| "nginx"` | Yes | Ingress controller type |
| `replicas` | `number` | Yes | Number of replicas |
| `dashboard` | `boolean` | No | Enable Traefik dashboard |
| `dashboard_subdomain` | `string` | No | Subdomain for dashboard |

## Features

### Routing
- Host-based routing
- Path-based routing
- Header matching
- Weighted round-robin

### TLS
- Automatic certificate management via cert-manager
- Let's Encrypt integration
- TLS passthrough

### Middleware
- Rate limiting
- Authentication (BasicAuth, ForwardAuth)
- Headers manipulation
- Redirect/rewrite

## Related Documentation

- [Cluster Architecture](./cluster-architecture.md)
- [Cert-Manager](./cert-manager.md)
- [Apps Layer](../03-layers/apps.md)
