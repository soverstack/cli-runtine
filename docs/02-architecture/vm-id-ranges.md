# VM ID Ranges

Soverstack uses reserved VM ID ranges to organize infrastructure by role.

## Overview

VM IDs are assigned based on their role in the infrastructure. This convention:
- Makes it easy to identify VMs by ID
- Prevents ID conflicts
- Enables validation of correct placement
- Simplifies firewall rules

## Reserved Ranges

| Range | Category | Description | Examples |
|-------|----------|-------------|----------|
| **1-49** | FIREWALL | Network firewalls | VyOS, OPNsense |
| **50-69** | DNS_LB | DNS load balancers | dnsdist |
| **70-99** | DNS_SERVER | DNS servers | PowerDNS |
| **100-149** | BASTION | VPN/Bastion hosts | Headscale, WireGuard |
| **150-199** | SECRETS | Secrets management | OpenBao, Vault |
| **200-249** | IAM_SSO | Identity providers | Keycloak, Authentik |
| **250-279** | DATABASE | Databases | PostgreSQL |
| **280-299** | CACHE | Cache servers | Redis, Valkey |
| **300-319** | MONITORING | Metrics collection | Prometheus |
| **320-329** | ALERTING | Alert management | Alertmanager |
| **330-349** | DASHBOARDS | Visualization | Grafana |
| **350-369** | LOGGING | Log aggregation | Loki |
| **370-399** | SIEM | Security monitoring | Wazuh, Falco |
| **400-449** | LOAD_BALANCER | Load balancers | HAProxy, Nginx |
| **450-469** | TOOLS | Management tools | Soverstack, Pentest |
| **470-499** | CI_CD | CI/CD infrastructure | GitLab runners, PBS |
| **500-599** | K8S_MASTER | Kubernetes control plane | K8s masters |
| **600-3000** | K8S_WORKER | Kubernetes data plane | K8s workers |
| **3001+** | APPLICATIONS | Custom applications | Your apps |

## Type Definition

Defined in [`VM_ID_RANGES`](../08-reference/types/VM_ID_RANGES.md):

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

## Role Mapping

Each [`VMRole`](../08-reference/types/VMRole.md) maps to a specific range:

| Role | Range | Example VMs |
|------|-------|-------------|
| `firewall` | FIREWALL | vyos-01, vyos-02 |
| `dns_lb` | DNS_LB | dnsdist-01, dnsdist-02 |
| `dns_server` | DNS_SERVER | powerdns-01, powerdns-02 |
| `bastion` | BASTION | headscale-01, headscale-02 |
| `secrets` | SECRETS | openbao-01, openbao-02 |
| `iam_sso` | IAM_SSO | keycloak-01, keycloak-02 |
| `database` | DATABASE | postgres-01, postgres-02, postgres-03 |
| `cache` | CACHE | redis-01, redis-02, redis-03 |
| `monitoring` | MONITORING | prometheus-01, prometheus-02 |
| `alerting` | ALERTING | alertmanager-01, alertmanager-02 |
| `dashboards` | DASHBOARDS | grafana-01, grafana-02 |
| `logging` | LOGGING | loki-01, loki-02 |
| `siem` | SIEM | wazuh-01 |
| `load_balancer` | LOAD_BALANCER | haproxy-01, haproxy-02 |
| `pentest` | TOOLS | pentest-01 |
| `management` | TOOLS | soverstack-01 |
| `ci_runner` | CI_CD | runner-01 |
| `k8s_master` | K8S_MASTER | k8s-master-01, k8s-master-02 |
| `k8s_worker` | K8S_WORKER | k8s-worker-01, k8s-worker-02 |
| `general_purpose` | APPLICATIONS | myapp-01 |

## Validation

Soverstack validates that VM IDs match their assigned roles:

```bash
# This will fail validation
virtual_machines:
  - name: postgres-01
    vm_id: 100           # ❌ Wrong! 100 is in BASTION range
    role: database       # Database should be 250-279
```

Correct configuration:

```yaml
virtual_machines:
  - name: postgres-01
    vm_id: 250           # ✅ Correct! In DATABASE range
    role: database
```

## Default Assignments

The `core-compute.yaml` template uses these default IDs:

| VM | ID | Role |
|----|----|----|
| vyos-01 | 1 | firewall |
| vyos-02 | 2 | firewall |
| dnsdist-01 | 50 | dns_lb |
| dnsdist-02 | 51 | dns_lb |
| powerdns-01 | 70 | dns_server |
| powerdns-02 | 71 | dns_server |
| headscale-01 | 100 | bastion |
| headscale-02 | 101 | bastion |
| openbao-01 | 150 | secrets |
| openbao-02 | 151 | secrets |
| keycloak-01 | 200 | iam_sso |
| keycloak-02 | 201 | iam_sso |
| postgres-01 | 250 | database |
| postgres-02 | 251 | database |
| postgres-03 | 252 | database |
| redis-01 | 280 | cache |
| redis-02 | 281 | cache |
| redis-03 | 282 | cache |
| prometheus-01 | 300 | monitoring |
| prometheus-02 | 301 | monitoring |
| alertmanager-01 | 320 | alerting |
| alertmanager-02 | 321 | alerting |
| grafana-01 | 330 | dashboards |
| grafana-02 | 331 | dashboards |
| loki-01 | 350 | logging |
| loki-02 | 351 | logging |
| wazuh-01 | 370 | siem |
| haproxy-01 | 400 | load_balancer |
| haproxy-02 | 401 | load_balancer |
| soverstack-01 | 450 | management |

## Custom Applications

For your own applications, use IDs starting from 3001:

```yaml
virtual_machines:
  - name: myapp-web-01
    vm_id: 3001
    role: general_purpose
    type_definition: app-medium

  - name: myapp-web-02
    vm_id: 3002
    role: general_purpose
    type_definition: app-medium

  - name: myapp-api-01
    vm_id: 3010
    role: general_purpose
    type_definition: app-large
```

## See Also

- [VMRole Type](../08-reference/types/VMRole.md)
- [Compute Layer](../03-layers/compute.md)
- [Infrastructure Requirements](../08-reference/infrastructure-requirements.md)
