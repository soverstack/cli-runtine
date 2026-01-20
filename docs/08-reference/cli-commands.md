# CLI Commands

Complete reference for Soverstack CLI commands.

## Command Overview

| Command | Description |
|---------|-------------|
| `init` | Initialize a new project |
| `validate` | Validate configuration |
| `plan` | Preview changes |
| `apply` | Apply changes |
| `destroy` | Destroy infrastructure |
| `dns:update` | Update DNS records |
| `graph` | Generate infrastructure graph |
| `generate:ssh-keys` | Generate SSH keys |

## TypeScript Definition

```typescript
export type SoverstackCommand =
  | "init"
  | "validate"
  | "plan"
  | "apply"
  | "destroy"
  | "dns:update"
  | "graph"
  | "graph:all"
  | "graph:cluster"
  | "graph:datacenter"
  | "graph:compute"
  | "graph:feature"
  | "graph:firewall"
  | "graph:bastion"
  | "generate:ssh-keys";
```

## Commands

### init

Initialize a new Soverstack project.

```bash
soverstack init [options]
```

| Option | Description |
|--------|-------------|
| `--tier` | Infrastructure tier (local/production/enterprise) |
| `--domain` | Primary domain |

### validate

Validate configuration files.

```bash
soverstack validate [options]
```

| Option | Type | Description |
|--------|------|-------------|
| `--layer` | `LayerType` | Validate specific layer |
| `--name` | `string` | Validate specific resource |
| `--verbose` | `boolean` | Show detailed output |

### plan

Preview infrastructure changes.

```bash
soverstack plan [options]
```

| Option | Type | Description |
|--------|------|-------------|
| `--layer` | `LayerType` | Plan specific layer |
| `--name` | `string` | Plan specific resource |
| `--dry-run` | `boolean` | Don't save plan |

### apply

Apply infrastructure changes.

```bash
soverstack apply [options]
```

| Option | Type | Description |
|--------|------|-------------|
| `--layer` | `LayerType` | Apply specific layer |
| `--name` | `string` | Apply specific resource |
| `--auto-approve` | `boolean` | Skip confirmation |
| `--force` | `boolean` | Force apply |

### destroy

Destroy infrastructure resources.

```bash
soverstack destroy [options]
```

| Option | Type | Description |
|--------|------|-------------|
| `--layer` | `LayerType` | Destroy specific layer |
| `--name` | `string` | Destroy specific resource |
| `--auto-approve` | `boolean` | Skip confirmation |

### graph

Generate infrastructure visualization.

```bash
soverstack graph [type]
```

Types: `all`, `cluster`, `datacenter`, `compute`, `feature`, `firewall`, `bastion`

### generate:ssh-keys

Generate or rotate SSH keys.

```bash
soverstack generate:ssh-keys [options]
```

| Option | Description |
|--------|-------------|
| `--rotate` | Rotate existing keys |
| `--output` | Output directory |

## Layer Types

```typescript
export type LayerType =
  | "datacenter"
  | "compute"
  | "cluster"
  | "database"
  | "networking"
  | "security"
  | "observability"
  | "apps";
```

## Command Options

All commands support these common options:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `--dry-run` | `boolean` | `false` | Preview without changes |
| `--verbose` | `boolean` | `false` | Detailed output |
| `--force` | `boolean` | `false` | Override safety checks |
| `--environment` | `string` | - | Target environment |

## Related Documentation

- [Deployment Workflow](../06-operations/deployment-workflow.md)
- [Validation](../06-operations/validation.md)
- [Apply Changes](../06-operations/apply-changes.md)
