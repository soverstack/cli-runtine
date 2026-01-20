---
id: vm-based-on-type
title: VMBasedOnType
sidebar_position: 31
---

# VMBasedOnType

VM utilisant un type d'instance prédéfini.

## Definition

```typescript
export interface VMBasedOnType extends VMBase {
  type_definition: string;
}
```

## Properties

Inherits all properties from [`VMBase`](./VMBase.md), plus:

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `type_definition` | `string` | Yes | Reference to ComputeType.name |

## Example

```yaml
instance_type_definitions:
  - name: small
    cpu: 2
    ram: 4096
    disk: 50
    os_template: debian-12-cloudinit
    disk_type: distributed

virtual_machines:
  - name: headscale-1
    vm_id: 100
    host: pve-1
    role: bastion
    type_definition: small  # References "small" type above
```

## Benefits

- Consistent VM sizing
- Easy to change specs across multiple VMs
- Reduces configuration duplication

## Related Types

- [VMBase](./VMBase.md)
- [VMCustom](./VMCustom.md)
- [ComputeType](./ComputeType.md)
