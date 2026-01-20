---
id: database-definition
title: DatabaseDefinition
sidebar_position: 62
---

# DatabaseDefinition

Définition d'une base de données dans un cluster PostgreSQL.

## Definition

```typescript
export interface DatabaseDefinition {
  name: string;
  owner: string;
}
```

## Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `name` | `string` | Yes | Database name |
| `owner` | `string` | Yes | Database owner username |

## Example

```yaml
databases:
  - type: postgresql
    version: "16"
    cluster:
      name: core-cluster
      ha: true
      vm_ids: [250, 251, 252]
    databases:
      - name: keycloak
        owner: keycloak
      - name: headscale
        owner: headscale
      - name: powerdns
        owner: powerdns
      - name: grafana
        owner: grafana
```

## Notes

- Database owner is automatically created with the database
- Passwords are managed via the cluster's `credentials` reference
- Each database can have additional users configured separately

## Related Types

- [DatabaseCluster](./DatabaseCluster.md)
- [DatabasesLayer](./DatabasesLayer.md)
