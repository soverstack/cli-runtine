---
id: vm-base
title: VMBase
sidebar_position: 30
---

# VMBase

Interface de base pour les propriétés des VMs.

## Definition

```typescript
export interface VMBase {
  name: string;
  vm_id: number;
  host: string;
  role: VMRole;
  public_ip?: string;
  status?: "running" | "stopped" | "provisioning";
}
```

## Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `name` | `string` | Yes | Unique VM name |
| `vm_id` | `number` | Yes | Proxmox VM ID |
| `host` | `string` | Yes | Target Proxmox node |
| `role` | [`VMRole`](./VMRole.md) | Yes | VM role classification |
| `public_ip` | `string` | No | Public IP if assigned |
| `status` | `string` | No | VM status |

## Status Options

| Value | Description |
|-------|-------------|
| `running` | VM is running |
| `stopped` | VM is stopped |
| `provisioning` | VM is being created |

## VM ID Validation

VM IDs must match their assigned role's range:

| Role | Valid Range |
|------|-------------|
| `firewall` | 1-49 |
| `bastion` | 100-149 |
| `database` | 250-279 |
| `k8s_master` | 500-599 |
| `k8s_worker` | 600-3000 |

## Related Types

- [VMBasedOnType](./VMBasedOnType.md)
- [VMCustom](./VMCustom.md)
- [VMRole](./VMRole.md)
