---
id: server-description-type
title: ServerDescriptionType
sidebar_position: 63
---

# ServerDescriptionType

Description matérielle du serveur physique.

## Definition

```typescript
export interface ServerDescriptionType {
  cpu: number;
  cores: number;
  disks?: ServerDescriptionDiskType[];
}

export interface ServerDescriptionDiskType {
  type: "ssd" | "hdd" | "nvme" | "sata" | "sas" | "scsi" | "ide";
  size: number;
}
```

## ServerDescriptionType Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `cpu` | `number` | Yes | Number of CPU sockets |
| `cores` | `number` | Yes | Total CPU cores |
| `disks` | `ServerDescriptionDiskType[]` | No | Disk configuration |

## ServerDescriptionDiskType Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `type` | `string` | Yes | Disk type |
| `size` | `number` | Yes | Size in GB |

## Disk Types

| Value | Description |
|-------|-------------|
| `nvme` | NVMe SSD (fastest) |
| `ssd` | SATA SSD |
| `hdd` | Hard disk drive |
| `sata` | SATA interface |
| `sas` | SAS interface |
| `scsi` | SCSI interface |
| `ide` | IDE interface |

## Example

```yaml
servers:
  - name: pve-1
    description:
      cpu: 2
      cores: 64
      disks:
        - type: nvme
          size: 1000
        - type: nvme
          size: 1000
        - type: hdd
          size: 8000
        - type: hdd
          size: 8000
```

## Related Types

- [Datacenter](./Datacenter.md)
