# Datacenter Layer

The datacenter layer defines physical Proxmox VE servers.

## Schema

Defined by [`Datacenter`](../08-reference/types/Datacenter.md) interface.

## Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `name` | `string` | ✅ | Unique datacenter identifier |
| `servers` | [`Server[]`](#server) | ✅ | List of Proxmox servers |

### Server

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `name` | `string` | ✅ | Unique server name (e.g., `pve-01`) |
| `id` | `number` | ✅ | Proxmox node ID |
| `ip` | `string` | ✅ | Server IP address |
| `port` | `number` | ✅ | SSH port (usually 22) |
| `os` | `"proxmox"` \| `"debian"` \| `"ubuntu"` \| `"rescue"` | ✅ | Operating system |
| `password` | [`CredentialRef`](../08-reference/types/CredentialRef.md) | ✅ | Root password reference |
| `disk_encryption` | [`DiskEncryption`](#disk-encryption) | ✅ | Disk encryption config |
| `is_gpu_server` | `boolean` | ❌ | GPU passthrough enabled |
| `description` | [`ServerDescription`](#server-description) | ❌ | Hardware description |

### Disk Encryption

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `enabled` | `boolean` | ✅ | Enable LUKS encryption |
| `password` | [`CredentialRef`](../08-reference/types/CredentialRef.md) | ✅ | Encryption password |

### Server Description

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `cpu` | `number` | ❌ | Number of CPUs |
| `cores` | `number` | ❌ | Total CPU cores |
| `disks` | [`Disk[]`](#disk) | ❌ | Disk configuration |

### Disk

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `type` | `"nvme"` \| `"ssd"` \| `"hdd"` \| `"sata"` \| `"sas"` | ✅ | Disk type |
| `size` | `number` | ✅ | Size in GB |

## Example

```yaml
# layers/datacenter.yaml
name: dc-production

servers:
  - name: pve-01
    id: 1
    ip: "10.0.0.10"
    port: 22
    os: proxmox
    password:
      type: env
      var_name: PVE_PASSWORD_01
    disk_encryption:
      enabled: true
      password:
        type: env
        var_name: DISK_ENCRYPTION_PASSWORD
    description:
      cpu: 2
      cores: 32
      disks:
        - type: nvme
          size: 512
        - type: nvme
          size: 512

  - name: pve-02
    id: 2
    ip: "10.0.0.11"
    port: 22
    os: proxmox
    password:
      type: env
      var_name: PVE_PASSWORD_02
    disk_encryption:
      enabled: true
      password:
        type: env
        var_name: DISK_ENCRYPTION_PASSWORD

  - name: pve-03
    id: 3
    ip: "10.0.0.12"
    port: 22
    os: proxmox
    password:
      type: env
      var_name: PVE_PASSWORD_03
    disk_encryption:
      enabled: true
      password:
        type: env
        var_name: DISK_ENCRYPTION_PASSWORD
```

## Validation Rules

### All Tiers

| Rule | Severity |
|------|----------|
| `name` is required | Error |
| At least one server required | Critical |
| Server names must be unique | Critical |
| Valid IP format | Error |
| Password must use CredentialRef | Error |

### Production/Enterprise Tiers

| Rule | Severity |
|------|----------|
| Minimum 3 servers for quorum | Critical |
| Odd number of servers recommended | Warning |

## HA Requirements by Tier

| Tier | Min Servers | Quorum |
|------|-------------|--------|
| local | 1 | N/A |
| production | 3 | Required |
| enterprise | 3+ | Required |

## Credential Reference

Never use plain text passwords. Use [`CredentialRef`](../08-reference/types/CredentialRef.md):

```yaml
# ✅ Good - Environment variable
password:
  type: env
  var_name: PVE_PASSWORD_01

# ✅ Best - Vault
password:
  type: vault
  path: secret/data/proxmox/pve-01

# ❌ Bad - Never do this
password: "my-plain-text-password"
```

## Environment Variables

Create `.env.production`:

```bash
# Proxmox root passwords
PVE_PASSWORD_01=your-secure-password-1
PVE_PASSWORD_02=your-secure-password-2
PVE_PASSWORD_03=your-secure-password-3

# Disk encryption (same for all or different)
DISK_ENCRYPTION_PASSWORD=your-encryption-password
```

## GPU Servers

For GPU passthrough:

```yaml
servers:
  - name: pve-gpu-01
    id: 10
    ip: "10.0.0.20"
    port: 22
    os: proxmox
    is_gpu_server: true
    password:
      type: env
      var_name: PVE_PASSWORD_GPU
    disk_encryption:
      enabled: true
      password:
        type: env
        var_name: DISK_ENCRYPTION_PASSWORD
```

## See Also

- [CredentialRef Type](../08-reference/types/CredentialRef.md)
- [Datacenter Type](../08-reference/types/Datacenter.md)
- [Infrastructure Tiers](../02-architecture/infrastructure-tiers.md)
