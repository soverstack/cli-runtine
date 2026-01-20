# Apply Changes

Applying infrastructure changes to your environment.

## Overview

The `apply` command:

1. Validates configuration
2. Generates execution plan
3. Requests confirmation (unless --auto-approve)
4. Executes changes in order
5. Updates state

## Usage

```bash
# Apply all changes
soverstack apply

# Apply with auto-approve
soverstack apply --auto-approve

# Apply specific layer
soverstack apply --layer compute

# Dry run (plan only)
soverstack apply --dry-run
```

## Plan Result

Defined by [`PlanResult`](../08-reference/types/PlanResult.md) interface.

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `actions` | [`PlanAction[]`](../08-reference/types/PlanAction.md) | List of planned actions |
| `summary.to_create` | `number` | Resources to create |
| `summary.to_update` | `number` | Resources to update |
| `summary.to_delete` | `number` | Resources to delete |
| `warnings` | `string[]` | Warnings to review |
| `requires_confirmation` | `boolean` | Needs user confirmation |

## Plan Action

Each action contains:

| Property | Type | Description |
|----------|------|-------------|
| `action` | `"create" \| "update" \| "delete"` | Action type |
| `layer` | `LayerType` | Affected layer |
| `resource_type` | `string` | Resource type |
| `resource_name` | `string` | Resource identifier |
| `details` | `string` | Additional details |
| `depends_on` | `string[]` | Dependencies |

## Apply Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `--layer` | `LayerType` | all | Layer to apply |
| `--auto-approve` | `boolean` | false | Skip confirmation |
| `--dry-run` | `boolean` | false | Plan only |
| `--verbose` | `boolean` | false | Detailed output |
| `--force` | `boolean` | false | Force apply |

## Execution Order

Changes are applied in dependency order:

1. Datacenter (physical servers)
2. Networking (firewall, VPN, DNS)
3. Compute (VMs)
4. Databases (PostgreSQL clusters)
5. Cluster (Kubernetes)
6. Security (Vault, Keycloak)
7. Observability (monitoring stack)
8. Apps (applications)

## Related Documentation

- [Deployment Workflow](./deployment-workflow.md)
- [Rollback](./rollback.md)
- [PlanResult Type Reference](../08-reference/types/PlanResult.md)
