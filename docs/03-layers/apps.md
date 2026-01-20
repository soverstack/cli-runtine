# Apps Layer

The apps layer configures application features and subdomain routing.

## Schema

Defined by [`AppsConfig`](../08-reference/types/AppsConfig.md) interface.

## Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `apps` | `Record<string, AppConfig>` | Yes | Application configurations |

## AppConfig

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `enabled` | `boolean` | Yes | Enable the application |
| `sub_domains` | `string` | Yes | Subdomain(s) for routing |
| `accessible_outside_vpn` | `boolean` | No | Public access (default: false) |
| `replicas` | `number` | No | Number of replicas |
| `resources` | `ResourceConfig` | No | CPU/memory limits |

## Default Applications

Soverstack includes these pre-configured applications:

| App Key | Subdomain | Description |
|---------|-----------|-------------|
| `monitoring` | `prometheus` | Metrics collection |
| `alerting` | `alertmanager` | Alert routing |
| `grafana` | `grafana` | Dashboards |
| `logging` | `loki` | Log aggregation |
| `siem` | `wazuh` | Security events |
| `argocd` | `argocd` | GitOps CD |
| `registry` | `registry` | Container registry |

## Complete Example

```yaml
# layers/apps.yaml

apps:
  # Monitoring Stack
  monitoring:
    enabled: true
    sub_domains: prometheus
    accessible_outside_vpn: false

  alerting:
    enabled: true
    sub_domains: alertmanager
    accessible_outside_vpn: false

  grafana:
    enabled: true
    sub_domains: grafana
    accessible_outside_vpn: false

  logging:
    enabled: true
    sub_domains: loki
    accessible_outside_vpn: false

  # Security
  siem:
    enabled: true
    sub_domains: wazuh
    accessible_outside_vpn: false

  # CI/CD
  argocd:
    enabled: true
    sub_domains: argocd
    accessible_outside_vpn: false

  # Container Registry
  registry:
    enabled: true
    sub_domains: registry
    accessible_outside_vpn: false
    resources:
      memory: 2Gi
      cpu: 1000m

  # Custom Application
  myapp:
    enabled: true
    sub_domains: app
    accessible_outside_vpn: true
    replicas: 3
    resources:
      memory: 1Gi
      cpu: 500m
```

## URL Generation

Subdomains are combined with the domain from `platform.yaml`:

```
{subdomain}.{domain}

Example:
- grafana.example.com
- prometheus.example.com
- app.example.com
```

## Access Control

### VPN-Only (Default)

```yaml
accessible_outside_vpn: false
```

- Only accessible via Headscale VPN
- Recommended for internal tools
- Grafana, Prometheus, ArgoCD

### Public Access

```yaml
accessible_outside_vpn: true
```

- Accessible from internet
- Protected by TLS and authentication
- User-facing applications

## Resource Configuration

```yaml
resources:
  memory: 1Gi
  cpu: 500m
  storage: 10Gi
```

| Property | Description | Example |
|----------|-------------|---------|
| `memory` | Memory limit | `512Mi`, `2Gi` |
| `cpu` | CPU limit (millicores) | `250m`, `1000m` |
| `storage` | Persistent storage | `10Gi`, `100Gi` |

## Validation Rules

| Rule | Tier | Severity |
|------|------|----------|
| Unique subdomain per app | All | Critical |
| `accessible_outside_vpn` explicit | Production+ | Warning |
| Resources defined | Production+ | Warning |

## Integration with Ingress

Apps automatically get:

1. **TLS Certificate** via cert-manager
2. **Ingress Route** via Traefik
3. **DNS Record** via PowerDNS
4. **OIDC Protection** via Keycloak (if enabled)

## See Also

- [AppsConfig Type](../08-reference/types/AppsConfig.md)
- [Traefik Ingress](../05-kubernetes/traefik-ingress.md)
- [DNS Configuration](../04-services/powerdns.md)
