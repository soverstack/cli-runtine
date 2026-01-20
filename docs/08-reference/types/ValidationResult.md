---
id: validation-result
title: ValidationResult
sidebar_position: 70
---

# ValidationResult

Interface de sortie de validation.

## Definition

```typescript
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  tier: InfrastructureTierType;
}

export interface ValidationError {
  layer: LayerType;
  field: string;
  message: string;
  code: string;
}

export interface ValidationWarning {
  layer: LayerType;
  field: string;
  message: string;
}
```

## ValidationResult Properties

| Property | Type | Description |
|----------|------|-------------|
| `valid` | `boolean` | Overall validation status |
| `errors` | `ValidationError[]` | List of errors |
| `warnings` | `ValidationWarning[]` | List of warnings |
| `tier` | [`InfrastructureTierType`](./InfrastructureTierType.md) | Detected tier |

## ValidationError Properties

| Property | Type | Description |
|----------|------|-------------|
| `layer` | [`LayerType`](./LayerType.md) | Affected layer |
| `field` | `string` | Field path |
| `message` | `string` | Error description |
| `code` | `string` | Error code |

## ValidationWarning Properties

| Property | Type | Description |
|----------|------|-------------|
| `layer` | [`LayerType`](./LayerType.md) | Affected layer |
| `field` | `string` | Field path |
| `message` | `string` | Warning description |

## Example Output

```json
{
  "valid": false,
  "tier": "production",
  "errors": [
    {
      "layer": "compute",
      "field": "virtual_machines[0].vm_id",
      "message": "VM ID 500 is outside FIREWALL range (1-49) for role 'firewall'",
      "code": "VM_ID_OUT_OF_RANGE"
    }
  ],
  "warnings": [
    {
      "layer": "database",
      "field": "databases[0].backup",
      "message": "No backup configured for production tier"
    }
  ]
}
```

## Related Types

- [LayerType](./LayerType.md)
- [InfrastructureTierType](./InfrastructureTierType.md)
