# VM ID Ranges

Reserved VM ID ranges for different infrastructure roles.

## Overview

Soverstack uses predefined VM ID ranges to:
- Organize VMs by role
- Prevent ID conflicts
- Enable validation
- Simplify operations

## VM ID Ranges

| Range | Min | Max | Role | Description |
|-------|-----|-----|------|-------------|
| FIREWALL | 1 | 49 | `firewall` | VyOS, OPNsense |
| DNS_LB | 50 | 69 | `dns_lb` | dnsdist load balancer |
| DNS_SERVER | 70 | 99 | `dns_server` | PowerDNS |
| BASTION | 100 | 149 | `bastion` | Headscale, WireGuard |
| SECRETS | 150 | 199 | `secrets` | OpenBao, Vault |
| IAM_SSO | 200 | 249 | `iam_sso` | Keycloak, Authentik |
| DATABASE | 250 | 279 | `database` | PostgreSQL |
| CACHE | 280 | 299 | `cache` | Redis, Valkey |
| MONITORING | 300 | 319 | `monitoring` | Prometheus |
| ALERTING | 320 | 329 | `alerting` | Alertmanager |
| DASHBOARDS | 330 | 349 | `dashboards` | Grafana |
| LOGGING | 350 | 369 | `logging` | Loki |
| SIEM | 370 | 399 | `siem` | Wazuh, Falco |
| LOAD_BALANCER | 400 | 449 | `load_balancer` | HAProxy, Nginx |
| TOOLS | 450 | 469 | `pentest`, `management` | Security testing, Soverstack |
| CI_CD | 470 | 499 | `ci_runner` | GitLab runners, PBS |
| K8S_MASTER | 500 | 599 | `k8s_master` | K8s control plane |
| K8S_WORKER | 600 | 3000 | `k8s_worker` | K8s workers |
| APPLICATIONS | 3001 | 99999 | `general_purpose` | Custom apps |

## TypeScript Definition

```typescript
export const VM_ID_RANGES = {
  FIREWALL: { min: 1, max: 49, description: "VyOS, OPNsense" },
  DNS_LB: { min: 50, max: 69, description: "dnsdist" },
  DNS_SERVER: { min: 70, max: 99, description: "PowerDNS" },
  BASTION: { min: 100, max: 149, description: "Headscale, WireGuard" },
  SECRETS: { min: 150, max: 199, description: "OpenBao, Vault" },
  IAM_SSO: { min: 200, max: 249, description: "Keycloak, Authentik" },
  DATABASE: { min: 250, max: 279, description: "PostgreSQL" },
  CACHE: { min: 280, max: 299, description: "Redis, Valkey" },
  MONITORING: { min: 300, max: 319, description: "Prometheus" },
  ALERTING: { min: 320, max: 329, description: "Alertmanager" },
  DASHBOARDS: { min: 330, max: 349, description: "Grafana" },
  LOGGING: { min: 350, max: 369, description: "Loki" },
  SIEM: { min: 370, max: 399, description: "Wazuh, Falco" },
  LOAD_BALANCER: { min: 400, max: 449, description: "HAProxy, Nginx" },
  TOOLS: { min: 450, max: 469, description: "Pentest, Soverstack" },
  CI_CD: { min: 470, max: 499, description: "Runners, PBS" },
  K8S_MASTER: { min: 500, max: 599, description: "K8s control plane" },
  K8S_WORKER: { min: 600, max: 3000, description: "K8s workers" },
  APPLICATIONS: { min: 3001, max: 99999, description: "Custom apps" },
} as const;
```

## Validation

Soverstack validates VM IDs match their assigned role:

```yaml
# Valid - firewall VM in range 1-49
virtual_machines:
  - name: vyos-1
    vm_id: 10
    role: firewall

# Invalid - firewall role with ID outside range
virtual_machines:
  - name: vyos-1
    vm_id: 500  # ERROR: 500 is in K8S_MASTER range
    role: firewall
```

## Related Documentation

- [VMRole Type Reference](./types/VMRole.md)
- [Compute Layer](../03-layers/compute.md)
- [Architecture Overview](../02-architecture/overview.md)
