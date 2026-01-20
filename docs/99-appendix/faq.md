# Frequently Asked Questions

Common questions about Soverstack.

## General

### What is Soverstack?

Soverstack is an Infrastructure-as-Code platform that deploys and manages complete infrastructure stacks on Proxmox VE, including:
- Zero-trust networking (VyOS, Headscale)
- Kubernetes clusters (Cilium, Traefik)
- Database clusters (PostgreSQL with Patroni)
- Security services (Keycloak, OpenBao)
- Observability stack (Prometheus, Grafana, Loki)

### What infrastructure do I need?

Minimum requirements depend on your tier:

| Tier | Servers | Description |
|------|---------|-------------|
| Local | 1 | Development/testing |
| Production | 3 | HA production workloads |
| Enterprise | 3+ | Enterprise with compliance |

### Is Soverstack free?

Yes, Soverstack is open-source.

## Installation

### How do I install Soverstack?

```bash
npm install -g @soverstack/cli
```

### What are the prerequisites?

- Node.js 18+
- Proxmox VE 8.0+ servers
- SSH access to servers
- (Optional) Public IP block

## Configuration

### Where do I store secrets?

Use `CredentialRef` to reference secrets from:
- **Vault/OpenBao** (recommended for production)
- **Environment variables** (for development)
- **Files** (not recommended)

```yaml
password:
  type: vault
  path: secret/database/password
```

### How do I change infrastructure tier?

Edit `platform.yaml`:

```yaml
infrastructure_tier: production  # local | production | enterprise
```

Then re-validate and apply:

```bash
soverstack validate
soverstack apply
```

### Can I use custom VM IDs?

VM IDs must fall within the designated ranges for their role. See [VM ID Ranges](../08-reference/vm-id-ranges.md).

## Operations

### How do I add a new worker node?

1. Add to `cluster.yaml`:
   ```yaml
   worker_nodes:
     - name: worker-4
       vm_id: 603
   ```

2. Apply changes:
   ```bash
   soverstack apply --layer cluster
   ```

### How do I backup my infrastructure?

Soverstack configures automatic backups for:
- PostgreSQL (WAL archiving or pg_dump)
- Kubernetes (Velero)
- Vault (snapshots)

Configure backup in layer YAML files.

### How do I rollback changes?

```bash
# List available states
soverstack state list

# Rollback to previous state
soverstack state rollback --to <state-id>
```

## Troubleshooting

### Validation fails with "VM ID out of range"

Ensure your VM ID matches the role's designated range:

| Role | Range |
|------|-------|
| firewall | 1-49 |
| bastion | 100-149 |
| database | 250-279 |
| k8s_master | 500-599 |
| k8s_worker | 600-3000 |

### Cannot connect to Proxmox API

1. Check credentials in `.env` file
2. Verify API token has correct permissions
3. Ensure firewall allows API access

### VPN not connecting

1. Check Headscale service status
2. Verify OIDC configuration with Keycloak
3. Check firewall rules for UDP 41641

## Integration

### Can I use existing Proxmox servers?

Yes, configure them in `datacenter.yaml` with their existing IPs and credentials.

### Does Soverstack support multi-datacenter?

Multi-datacenter support is planned for future releases.

### Can I use Soverstack with Terraform?

Soverstack can coexist with Terraform. The `terraform/` directory in projects is for optional custom Terraform modules.
