# Secret Rotation

Procedures for rotating secrets and credentials.

## Overview

This runbook covers:
- Database password rotation
- SSH key rotation
- TLS certificate rotation
- API token rotation

## Prerequisites

- Access to OpenBao/Vault
- SSH access to VMs
- Understanding of secret dependencies

## Database Password Rotation

### Procedure

1. **Generate new password in Vault**
   ```bash
   vault write secret/database/core-cluster \
     password="$(openssl rand -base64 32)"
   ```

2. **Update PostgreSQL password**
   ```bash
   psql -c "ALTER USER postgres PASSWORD 'new_password';"
   ```

3. **Update application configurations**
   ```bash
   soverstack apply --layer database
   ```

4. **Restart dependent services**
   ```bash
   systemctl restart keycloak
   systemctl restart headscale
   ```

### Verification
- Applications can connect to database
- No authentication errors in logs

## SSH Key Rotation

### Procedure

1. **Generate new SSH keys**
   ```bash
   soverstack generate:ssh-keys --rotate
   ```

2. **Apply new keys to all VMs**
   ```bash
   soverstack apply --layer compute
   ```

3. **Remove old authorized_keys entries**
   ```bash
   # Handled automatically by Soverstack
   ```

4. **Update local SSH config**
   ```bash
   cp secrets/ssh/soverstack ~/.ssh/
   ```

### Verification
- SSH access works with new key
- Old key rejected

## TLS Certificate Rotation

### For Cert-Manager Managed Certs

Automatic rotation - no action needed.

### For Self-Signed Certs

1. **Generate new CA**
   ```bash
   soverstack generate:ca --rotate
   ```

2. **Apply to all services**
   ```bash
   soverstack apply
   ```

3. **Restart services**
   ```bash
   # Automatic restart during apply
   ```

### Verification
- No certificate warnings
- TLS connections successful

## API Token Rotation

### Proxmox API Tokens

1. **Create new token in Proxmox**
   ```
   Datacenter > Permissions > API Tokens > Add
   ```

2. **Update .env file**
   ```bash
   PROXMOX_TOKEN_ID=new_token@pve
   PROXMOX_TOKEN_SECRET=new_secret
   ```

3. **Verify access**
   ```bash
   soverstack validate
   ```

4. **Delete old token in Proxmox**

### Keycloak Client Secrets

1. **Rotate secret in Keycloak**
   ```
   Clients > client_name > Credentials > Regenerate Secret
   ```

2. **Update in Vault**
   ```bash
   vault write secret/keycloak/clients/client_name \
     secret="new_secret"
   ```

3. **Restart dependent services**

### Verification
- Services authenticate successfully
- No 401 errors in logs

## Schedule

| Secret Type | Rotation Frequency |
|-------------|-------------------|
| Database passwords | 90 days |
| SSH keys | 180 days |
| TLS certificates | Auto (before expiry) |
| API tokens | 90 days |

## Related Documentation

- [OpenBao Secrets](../04-services/openbao-secrets.md)
- [Security Layer](../03-layers/security.md)
- [Security Model](../02-architecture/security-model.md)
