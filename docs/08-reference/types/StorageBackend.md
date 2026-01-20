---
id: storage-backend
title: StorageBackend
sidebar_position: 60
---

# StorageBackend

Configuration du backend de stockage pour les backups.

## Definition

```typescript
export interface StorageBackend {
  server: string;
  type: "s3";
  endpoint?: string;
  bucket_prefix?: string;
}
```

## Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `server` | `string` | Yes | Reference to server name |
| `type` | `"s3"` | Yes | Storage type (S3/MinIO) |
| `endpoint` | `string` | No | S3 endpoint URL |
| `bucket_prefix` | `string` | No | Prefix for bucket names |

## Example

```yaml
# In platform.yaml
storage_backends:
  minio:
    server: backup-server
    type: s3
    endpoint: "10.0.30.1:9000"
    bucket_prefix: "soverstack-"

# Usage in database config
databases:
  - type: postgresql
    backup:
      storage_backend: minio  # References above
      schedule: "0 2 * * *"
```

## Notes

- Currently only S3-compatible storage is supported
- MinIO is the recommended S3-compatible storage
- Backup server should be on separate infrastructure for DR

## Related Types

- [Platform](./Platform.md)
- [DatabaseCluster](./DatabaseCluster.md)
- [VaultConfig](./VaultConfig.md)
