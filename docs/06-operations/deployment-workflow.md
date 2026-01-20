# Deployment Workflow

Complete workflow for deploying infrastructure changes.

## Overview

```
┌─────────────────────────────────────────────────────────────┐
│                   Deployment Workflow                        │
│                                                              │
│   ┌───────┐   ┌──────────┐   ┌──────┐   ┌───────┐          │
│   │ Edit  │──▶│ Validate │──▶│ Plan │──▶│ Apply │          │
│   │ YAML  │   │          │   │      │   │       │          │
│   └───────┘   └──────────┘   └──────┘   └───────┘          │
│       │            │            │           │               │
│       ▼            ▼            ▼           ▼               │
│   ┌───────┐   ┌──────────┐   ┌──────┐   ┌───────┐          │
│   │ Git   │   │ Schema   │   │ Diff │   │ Exec  │          │
│   │ Commit│   │ Check    │   │ View │   │ Plan  │          │
│   └───────┘   └──────────┘   └──────┘   └───────┘          │
└─────────────────────────────────────────────────────────────┘
```

## Steps

### 1. Edit Configuration

Modify YAML files in the `layers/` directory:

```bash
# Edit compute layer
vim layers/compute/compute.yaml

# Edit networking
vim layers/networking.yaml
```

### 2. Validate Configuration

```bash
soverstack validate
```

This checks:
- YAML syntax
- Schema compliance
- VM ID ranges
- HA requirements for tier

### 3. Review Plan

```bash
soverstack plan
```

Review the planned changes:
- Resources to create
- Resources to update
- Resources to delete

### 4. Apply Changes

```bash
soverstack apply
```

Or with auto-approve:

```bash
soverstack apply --auto-approve
```

### 5. Verify Deployment

Check the deployment status:

```bash
soverstack status
```

## Layer-Specific Deployment

Deploy changes to a specific layer:

```bash
# Only validate networking
soverstack validate --layer networking

# Only plan compute changes
soverstack plan --layer compute

# Only apply database changes
soverstack apply --layer database
```

## Related Documentation

- [Validation](./validation.md)
- [Apply Changes](./apply-changes.md)
- [Rollback](./rollback.md)
