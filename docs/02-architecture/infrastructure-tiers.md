# Infrastructure Tiers

Soverstack supports three infrastructure tiers with different requirements.

## Tier Comparison

| Aspect | Local | Production | Enterprise |
|--------|-------|------------|------------|
| **Purpose** | Development | Production workloads | Enterprise with compliance |
| **HA Required** | No | Yes | Yes |
| **Min Servers** | 1 | 3 | 3+ |
| **Min DB Nodes** | 1 | 3 | 3 |
| **Min K8s Masters** | 1 | 3 | 3 |
| **Min K8s Workers** | 1 | 2 | 3 |
| **Min Firewall VMs** | 1 | 2 | 2 |
| **Min VPN VMs** | 1 | 2 | 2 |

## HA Requirements

Defined in [`HA_REQUIREMENTS`](../08-reference/types/HA_REQUIREMENTS.md):

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
};
```

## Local Tier

**Use case**: Development and testing

### Characteristics
- Single server acceptable
- Relaxed validation (warnings instead of errors)
- VMCustom allowed (inline specs)
- Minimal resource requirements

### Example Configuration

```yaml
# platform.yaml
infrastructure_tier: local
```

### Resource Specs (Local)

| Service | vCPU | RAM | Disk |
|---------|------|-----|------|
| VyOS | 2 | 2 GB | 20 GB |
| Headscale | 1 | 2 GB | 20 GB |
| Keycloak | 2 | 4 GB | 40 GB |
| PostgreSQL | 2 | 4 GB | 50 GB |
| Prometheus | 2 | 4 GB | 50 GB |

## Production Tier

**Use case**: Production workloads

### Characteristics
- Minimum 3 servers required
- HA mandatory for all critical services
- VMCustom **not allowed** (must use instance_type_definitions)
- Strict validation

### Example Configuration

```yaml
# platform.yaml
infrastructure_tier: production
```

### Resource Specs (Production)

| Service | vCPU | RAM | Disk | Count |
|---------|------|-----|------|-------|
| VyOS | 4 | 4 GB | 20 GB | 2 |
| Headscale | 2 | 4 GB | 40 GB | 2 |
| Keycloak | 4 | 8 GB | 40 GB | 2 |
| PostgreSQL | 4 | 8 GB | 150 GB | 3 |
| Prometheus | 4 | 16 GB | 100 GB | 2 |

## Enterprise Tier

**Use case**: Enterprise with compliance requirements

### Characteristics
- All production requirements plus:
- Enhanced security validation
- Additional redundancy
- Compliance-ready configuration

### Example Configuration

```yaml
# platform.yaml
infrastructure_tier: enterprise
```

### Resource Specs (Enterprise)

| Service | vCPU | RAM | Disk | Count |
|---------|------|-----|------|-------|
| VyOS | 8 | 8 GB | 20 GB | 2 |
| Headscale | 4 | 8 GB | 40 GB | 3 |
| Keycloak | 4 | 16 GB | 60 GB | 3 |
| PostgreSQL | 8 | 16 GB | 300 GB | 3 |
| Prometheus | 4 | 32 GB | 200 GB | 2 |

## Validation Differences

### Local Tier
- Missing VMs → Warning
- VMCustom → Allowed
- Odd server count → Warning

### Production/Enterprise Tier
- Missing VMs → **Critical Error**
- VMCustom → **Critical Error**
- Odd server count → Warning

## Choosing a Tier

| Scenario | Recommended Tier |
|----------|------------------|
| Learning Soverstack | `local` |
| Development environment | `local` |
| Staging environment | `production` |
| Production workloads | `production` |
| Regulated industries | `enterprise` |
| Multi-region deployments | `enterprise` |

## Migrating Between Tiers

### Local → Production

1. Add additional servers
2. Update `infrastructure_tier: production`
3. Run validation: `soverstack validate`
4. Fix any errors (add missing VMs, convert VMCustom to types)
5. Apply: `soverstack apply`

### Production → Enterprise

1. Review enterprise requirements
2. Update `infrastructure_tier: enterprise`
3. Run validation
4. Add additional resources if needed
5. Apply

## See Also

- [VM ID Ranges](./vm-id-ranges.md)
- [Infrastructure Requirements](../08-reference/infrastructure-requirements.md)
- [Validation Rules](../06-operations/validation.md)
