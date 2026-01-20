# Platform YAML Schema

The `platform.yaml` file is the main configuration entry point.

## Schema

Defined by [`Platform`](./types/Platform.md) interface.

## Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `project_name` | `string` | Yes | Unique project identifier |
| `version` | `string` | Yes | Soverstack version |
| `environment` | `string` | No | Environment name |
| `domain` | `string` | Yes | Primary domain for services |
| `infrastructure_tier` | [`InfrastructureTierType`](./types/InfrastructureTierType.md) | Yes | `"local" \| "production" \| "enterprise"` |
| `storage_backends` | `Record<string, StorageBackend>` | No | Backup storage definitions |
| `layers` | `object` | Yes | Layer file references |
| `ssh` | `string` | Yes | Path to SSH configuration |
| `state` | `object` | Yes | State backend configuration |

## Layers Object

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `datacenter` | `string` | Yes | Path to datacenter layer |
| `compute` | `string` | No | Path to compute layer |
| `cluster` | `string` | No | Path to cluster layer |
| `database` | `string` | No | Path to database layer |
| `networking` | `string` | No | Path to networking layer |
| `security` | `string` | No | Path to security layer |
| `observability` | `string` | No | Path to observability layer |
| `apps` | `string` | No | Path to apps layer |

## State Object

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `backend` | [`BackendType`](./types/BackendType.md) | Yes | `"local" \| "aws" \| "gcr" \| "azure"` |
| `path` | `string` | Yes | State file path |

## Example

```yaml
project_name: my-infrastructure
version: "1.0.0"
environment: production
domain: example.com
infrastructure_tier: production

storage_backends:
  minio:
    server: backup-server
    type: s3
    endpoint: "10.0.30.1:9000"
    bucket_prefix: "soverstack-"

layers:
  datacenter: ./layers/datacenter.yaml
  networking: ./layers/networking.yaml
  compute: ./layers/compute/compute.yaml
  database: ./layers/databases/databases.yaml
  cluster: ./layers/cluster.yaml
  security: ./layers/security.yaml
  observability: ./layers/observability.yaml
  apps: ./layers/apps.yaml

ssh: ./secrets/ssh/soverstack

state:
  backend: local
  path: ./.soverstack/state
```

## Related Documentation

- [Platform Type Reference](./types/Platform.md)
- [Getting Started](../01-getting-started/README.md)
- [Architecture Overview](../02-architecture/overview.md)
