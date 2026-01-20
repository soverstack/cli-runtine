---
id: operations
title: Operations
sidebar_position: 1
---

# Operations Documentation

This section covers daily operations and management of Soverstack infrastructure.

## Contents

1. [Deployment Workflow](./deployment-workflow.md) - How to deploy changes
2. [Validation](./validation.md) - Validating configuration
3. [Apply Changes](./apply-changes.md) - Applying infrastructure changes
4. [Rollback](./rollback.md) - Rolling back changes
5. [Troubleshooting](./troubleshooting.md) - Common issues and solutions

## CLI Commands Overview

| Command | Description |
|---------|-------------|
| `soverstack init` | Initialize a new project |
| `soverstack validate` | Validate configuration |
| `soverstack plan` | Preview changes |
| `soverstack apply` | Apply changes |
| `soverstack destroy` | Destroy infrastructure |

## Workflow

```mermaid
flowchart LR
    A[Edit YAML] --> B[Validate Config]
    B --> C[Plan Review]
    C --> D[Apply Changes]
    
    style A fill:#e3f2fd
    style B fill:#f3e5f5
    style C fill:#e8f5e9
    style D fill:#fff3e0
```
