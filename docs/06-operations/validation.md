# Validation

Validating configuration before applying changes.

## Overview

The `validate` command checks:

1. YAML syntax validity
2. Schema compliance (types.ts)
3. VM ID range constraints
4. HA requirements for infrastructure tier
5. Cross-layer references

## Usage

```bash
# Validate all layers
soverstack validate

# Validate specific layer
soverstack validate --layer compute

# Validate with verbose output
soverstack validate --verbose
```

## Validation Result

Defined by [`ValidationResult`](../08-reference/types/ValidationResult.md) interface.

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `valid` | `boolean` | Overall validation status |
| `errors` | [`ValidationError[]`](../08-reference/types/ValidationError.md) | List of errors |
| `warnings` | [`ValidationWarning[]`](../08-reference/types/ValidationWarning.md) | List of warnings |
| `tier` | [`InfrastructureTierType`](../08-reference/types/InfrastructureTierType.md) | Detected tier |

## Common Validation Errors

### VM ID Out of Range

```
ERROR: compute.virtual_machines[0].vm_id (42) is outside FIREWALL range (1-49)
```

**Fix:** Use the correct VM ID range for the role.

### Missing Required Field

```
ERROR: databases.databases[0].cluster.name is required
```

**Fix:** Add the missing field to your configuration.

### HA Requirements Not Met

```
ERROR: production tier requires minimum 3 database nodes, got 1
```

**Fix:** Add more nodes or change to `local` tier.

## Validation Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `--layer` | `string` | all | Layer to validate |
| `--verbose` | `boolean` | false | Show detailed output |
| `--name` | `string` | - | Specific resource name |

## Related Documentation

- [Deployment Workflow](./deployment-workflow.md)
- [ValidationResult Type Reference](../08-reference/types/ValidationResult.md)
- [VM ID Ranges](../02-architecture/vm-id-ranges.md)
