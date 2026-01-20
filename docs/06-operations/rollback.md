# Rollback

Rolling back infrastructure changes.

## Overview

Soverstack supports rollback through:

1. **State-based rollback** - Revert to previous state
2. **Git-based rollback** - Revert YAML and re-apply
3. **Layer-specific rollback** - Rollback single layer

## State-Based Rollback

Each apply creates a state snapshot:

```bash
# List available states
soverstack state list

# Rollback to specific state
soverstack state rollback --to <state-id>
```

## Git-Based Rollback

Recommended approach for tracked changes:

```bash
# Revert YAML changes
git revert HEAD

# Re-apply configuration
soverstack apply
```

## Layer-Specific Rollback

Rollback changes to a specific layer:

```bash
# Rollback compute layer only
soverstack rollback --layer compute --to <state-id>
```

## Rollback Strategies

### Immediate Rollback

For critical failures during apply:

```bash
# Cancel current apply
Ctrl+C

# Apply previous state
soverstack state rollback --to previous
```

### Planned Rollback

For rolling back after testing:

```bash
# Check current state
soverstack state show

# Rollback to known-good state
soverstack state rollback --to <state-id> --auto-approve
```

## State Management

State files are stored in:

```
.soverstack/
├── state/
│   ├── datacenter.tfstate
│   ├── compute.tfstate
│   └── ...
└── snapshots/
    ├── 2024-01-15T10:30:00Z/
    └── 2024-01-14T15:45:00Z/
```

## Limitations

- Database data is not automatically rolled back
- Kubernetes PVCs may need manual intervention
- Some changes are not reversible (e.g., data deletion)

## Related Documentation

- [Apply Changes](./apply-changes.md)
- [Deployment Workflow](./deployment-workflow.md)
- [Disaster Recovery](../07-runbooks/cluster-recovery.md)
