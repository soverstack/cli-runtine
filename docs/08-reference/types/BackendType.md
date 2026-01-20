---
id: backend-type
title: BackendType
sidebar_position: 82
---

# BackendType

Énumération des types de backend d'état.

## Definition

```typescript
export type BackendType = "local" | "aws" | "gcr" | "azure";
```

## Values

| Value | Description |
|-------|-------------|
| `local` | Local filesystem storage |
| `aws` | AWS S3 bucket |
| `gcr` | Google Cloud Storage |
| `azure` | Azure Blob Storage |

## Usage

```yaml
state:
  backend: local
  path: ./.soverstack/state
```

## Local Backend

Stores state in local filesystem:

```yaml
state:
  backend: local
  path: ./.soverstack/state
```

## Cloud Backends

For team collaboration, use cloud backends:

```yaml
# AWS S3
state:
  backend: aws
  path: s3://my-bucket/soverstack/state

# Google Cloud Storage
state:
  backend: gcr
  path: gs://my-bucket/soverstack/state

# Azure Blob
state:
  backend: azure
  path: azure://container/soverstack/state
```

## Related Types

- [Platform](./Platform.md)
