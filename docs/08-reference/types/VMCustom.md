---
id: vm-custom
title: VMCustom
sidebar_position: 32
---

# VMCustom

VM avec spécifications personnalisées en ligne.

## Definition

```typescript
export interface VMCustom extends VMBase {
  cpu: number;
  ram: number;
  disk: number;
  disk_type: "distributed" | "local";
  os_template: string;
}
```

## Properties

Inherits all properties from [`VMBase`](./VMBase.md), plus:

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `cpu` | `number` | Yes | Number of CPU cores |
| `ram` | `number` | Yes | RAM in MB |
| `disk` | `number` | Yes | Disk size in GB |
| `disk_type` | `"distributed" \| "local"` | Yes | Storage backend |
| `os_template` | `string` | Yes | OS template name or URL |

## Disk Type Options

| Value | Description |
|-------|-------------|
| `distributed` | Ceph distributed storage (HA) |
| `local` | Local node storage (faster) |

## Example

```yaml
virtual_machines:
  - name: database-1
    vm_id: 250
    host: pve-1
    role: database
    cpu: 8
    ram: 32768
    disk: 500
    disk_type: distributed
    os_template: debian-12-cloudinit
```

## When to Use

Use `VMCustom` when:
- VM needs unique specifications
- You need fine-grained control over resources
- The VM doesn't fit predefined types

Use [`VMBasedOnType`](./VMBasedOnType.md) when:
- Multiple VMs share the same specs
- You want consistent sizing
- Easier maintenance

## Related Types

- [VMBase](./VMBase.md)
- [VMBasedOnType](./VMBasedOnType.md)
- [ComputeConfig](./ComputeConfig.md)
