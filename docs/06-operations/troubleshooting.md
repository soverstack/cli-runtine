# Troubleshooting

Common issues and solutions.

## Validation Errors

### VM ID Conflict

**Error:**
```
ERROR: VM ID 500 is already in use by master-1
```

**Solution:**
- Check existing VMs: `soverstack status --layer compute`
- Use a different VM ID

### Schema Validation Failed

**Error:**
```
ERROR: networking.dns.type must be "powerdns" | "cloudflare" | "hybrid"
```

**Solution:**
- Check the type reference documentation
- Use a valid enum value

## Apply Failures

### SSH Connection Failed

**Error:**
```
ERROR: Cannot connect to server 10.0.0.1:22
```

**Solution:**
- Verify SSH credentials
- Check firewall rules
- Verify server is accessible

### Proxmox API Error

**Error:**
```
ERROR: Proxmox API returned 401 Unauthorized
```

**Solution:**
- Check credentials in `.env` file
- Verify API token permissions
- Check Proxmox user permissions

### VM Creation Failed

**Error:**
```
ERROR: Not enough resources on node pve-1
```

**Solution:**
- Check node resources: `soverstack status --layer datacenter`
- Move VM to different node
- Add more resources to node

## Network Issues

### DNS Resolution Failed

**Error:**
```
ERROR: Cannot resolve headscale.example.com
```

**Solution:**
- Check PowerDNS status
- Verify DNS zone configuration
- Check dnsdist load balancer

### VPN Connection Failed

**Error:**
```
ERROR: Headscale node unreachable
```

**Solution:**
- Check Headscale service status
- Verify firewall rules for UDP 41641
- Check OIDC configuration

## Database Issues

### Patroni Cluster Unhealthy

**Error:**
```
ERROR: PostgreSQL cluster has no leader
```

**Solution:**
- Check Patroni logs on all nodes
- Verify etcd cluster status
- Manual leader election if needed

### Replication Lag

**Error:**
```
WARNING: Replication lag > 10s on replica-2
```

**Solution:**
- Check network between nodes
- Verify disk I/O on replica
- Consider reducing write load

## Kubernetes Issues

### Node Not Ready

**Error:**
```
ERROR: Node worker-1 is NotReady
```

**Solution:**
- SSH to node and check kubelet logs
- Verify CNI (Cilium) is running
- Check node resources

### Pod Scheduling Failed

**Error:**
```
ERROR: 0/3 nodes are available: insufficient cpu
```

**Solution:**
- Add more worker nodes
- Reduce pod resource requests
- Enable auto-scaling

## Getting Help

1. Check logs: `.soverstack/logs/`
2. Run with verbose: `--verbose`
3. Check component status: `soverstack status`

## Related Documentation

- [Deployment Workflow](./deployment-workflow.md)
- [Runbooks](../07-runbooks/README.md)
- [Incident Response](../07-runbooks/incident-response.md)
