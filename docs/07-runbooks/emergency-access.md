# Emergency Access

Procedures for regaining access when normal methods fail.

## Overview

This runbook covers emergency access scenarios when:
- VPN is unavailable
- SSH keys are lost
- Keycloak is down
- Network is misconfigured

## Prerequisites

- Physical/console access to Proxmox servers
- Root credentials for Proxmox (stored offline)
- Emergency SSH key (stored offline)

## Scenario 1: VPN Unavailable

### Symptoms
- Cannot connect via Headscale
- VPN nodes are unreachable

### Procedure

1. **Access Proxmox directly**
   ```
   Connect via Proxmox console or IPMI
   ```

2. **Check Headscale VMs**
   ```bash
   qm list | grep headscale
   qm status <vm_id>
   ```

3. **Start Headscale if stopped**
   ```bash
   qm start <vm_id>
   ```

4. **Access Headscale VM console**
   ```bash
   qm terminal <vm_id>
   ```

5. **Check Headscale service**
   ```bash
   systemctl status headscale
   journalctl -u headscale -n 50
   ```

### Verification
- VPN connection succeeds
- All nodes reachable via VPN

## Scenario 2: SSH Keys Lost

### Symptoms
- Cannot SSH to any VM
- Key authentication fails

### Procedure

1. **Access VM via Proxmox console**
   ```bash
   qm terminal <vm_id>
   ```

2. **Add emergency SSH key**
   ```bash
   echo "ssh-rsa EMERGENCY_KEY..." >> /root/.ssh/authorized_keys
   ```

3. **Rotate all SSH keys**
   ```bash
   soverstack generate:ssh-keys --rotate
   soverstack apply --layer compute
   ```

### Verification
- SSH access restored with new keys
- Old keys no longer work

## Scenario 3: Keycloak Down

### Symptoms
- Cannot login to any service
- OIDC authentication fails

### Procedure

1. **Access Keycloak VM**
   ```bash
   qm terminal 200  # Primary Keycloak VM
   ```

2. **Check Keycloak service**
   ```bash
   systemctl status keycloak
   journalctl -u keycloak -n 100
   ```

3. **Check database connectivity**
   ```bash
   psql -h postgres-vip -U keycloak -d keycloak
   ```

4. **Restart Keycloak if needed**
   ```bash
   systemctl restart keycloak
   ```

### Verification
- Keycloak UI accessible
- OIDC login works for all services

## Scenario 4: Network Misconfigured

### Symptoms
- VMs cannot communicate
- Services unreachable

### Procedure

1. **Access firewall VM**
   ```bash
   qm terminal 10  # VyOS VM
   ```

2. **Check VyOS configuration**
   ```
   show configuration
   show interfaces
   show firewall
   ```

3. **Rollback to known-good config**
   ```
   rollback 1
   commit
   ```

### Verification
- Network connectivity restored
- All services reachable

## Related Documentation

- [VyOS Firewall](../04-services/vyos-firewall.md)
- [Headscale VPN](../04-services/headscale-vpn.md)
- [Keycloak IAM](../04-services/keycloak-iam.md)
