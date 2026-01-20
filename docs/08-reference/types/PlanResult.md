---
id: plan-result
title: PlanResult
sidebar_position: 71
---

# PlanResult

Interface de résultat d'exécution du plan.

## Definition

```typescript
export interface PlanResult {
  actions: PlanAction[];
  summary: {
    to_create: number;
    to_update: number;
    to_delete: number;
  };
  warnings: string[];
  requires_confirmation: boolean;
}

export interface PlanAction {
  action: "create" | "update" | "delete";
  layer: LayerType;
  resource_type: string;
  resource_name: string;
  details?: string;
  depends_on?: string[];
}
```

## PlanResult Properties

| Property | Type | Description |
|----------|------|-------------|
| `actions` | `PlanAction[]` | List of planned actions |
| `summary.to_create` | `number` | Resources to create |
| `summary.to_update` | `number` | Resources to update |
| `summary.to_delete` | `number` | Resources to delete |
| `warnings` | `string[]` | Warnings to review |
| `requires_confirmation` | `boolean` | Needs user confirmation |

## PlanAction Properties

| Property | Type | Description |
|----------|------|-------------|
| `action` | `"create" \| "update" \| "delete"` | Action type |
| `layer` | [`LayerType`](./LayerType.md) | Affected layer |
| `resource_type` | `string` | Type of resource |
| `resource_name` | `string` | Resource identifier |
| `details` | `string` | Additional details |
| `depends_on` | `string[]` | Dependencies |

## Example Output

```json
{
  "actions": [
    {
      "action": "create",
      "layer": "compute",
      "resource_type": "vm",
      "resource_name": "worker-4",
      "details": "4 CPU, 8GB RAM, 100GB disk",
      "depends_on": []
    },
    {
      "action": "update",
      "layer": "database",
      "resource_type": "database",
      "resource_name": "core-cluster",
      "details": "Adding new database 'app-db'",
      "depends_on": ["compute.worker-4"]
    }
  ],
  "summary": {
    "to_create": 1,
    "to_update": 1,
    "to_delete": 0
  },
  "warnings": [
    "Database update will cause brief connection interruption"
  ],
  "requires_confirmation": true
}
```

## Related Types

- [LayerType](./LayerType.md)
- [Plan](./Plan.md)
