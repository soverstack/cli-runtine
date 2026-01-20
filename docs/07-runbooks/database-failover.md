# Database Failover

Procedures for PostgreSQL cluster failover.

## Overview

This runbook covers:
- Automatic failover verification
- Manual failover procedures
- Split-brain recovery
- Data recovery

## Prerequisites

- SSH access to database VMs
- Patroni cluster running
- Understanding of replication lag

## Automatic Failover

Patroni handles automatic failover when:
- Primary node fails
- Primary becomes unreachable
- Primary has health check failures

### Verify Automatic Failover

1. **Check cluster status**
   ```bash
   patronictl -c /etc/patroni/patroni.yml list
   ```

2. **Expected output**
   ```
   + Cluster: core-cluster (7123456789) +
   | Member    | Host       | Role    | State   | Lag |
   +-----------+------------+---------+---------+-----+
   | db-node-1 | 10.0.25.1  | Leader  | running |     |
   | db-node-2 | 10.0.25.2  | Replica | running |   0 |
   | db-node-3 | 10.0.25.3  | Replica | running |   0 |
   +-----------+------------+---------+---------+-----+
   ```

## Manual Failover

### When to Use
- Planned maintenance
- Specific node needs to be leader
- Automatic failover failed

### Procedure

1. **Check current status**
   ```bash
   patronictl -c /etc/patroni/patroni.yml list
   ```

2. **Initiate switchover**
   ```bash
   patronictl -c /etc/patroni/patroni.yml switchover \
     --master db-node-1 \
     --candidate db-node-2 \
     --force
   ```

3. **Verify new leader**
   ```bash
   patronictl -c /etc/patroni/patroni.yml list
   ```

### Verification
- New leader is running
- Replicas are connected
- Replication lag is 0

## Split-Brain Recovery

### Symptoms
- Multiple nodes claim to be leader
- Data inconsistency
- Applications getting different data

### Procedure

1. **Stop all Patroni instances**
   ```bash
   # On all nodes
   systemctl stop patroni
   ```

2. **Identify node with latest data**
   ```bash
   # Check each node's timeline
   cat /var/lib/postgresql/16/main/global/pg_control
   ```

3. **Reinitialize other nodes from leader**
   ```bash
   patronictl -c /etc/patroni/patroni.yml reinit core-cluster db-node-2
   patronictl -c /etc/patroni/patroni.yml reinit core-cluster db-node-3
   ```

4. **Restart Patroni on all nodes**
   ```bash
   systemctl start patroni
   ```

### Verification
- Single leader in cluster
- All replicas synchronized
- No data inconsistency

## Data Recovery

### From WAL Archive

1. **Stop application traffic**
2. **Restore from backup**
   ```bash
   pg_restore --target-time="2024-01-15 10:00:00" ...
   ```

### From pg_dumpall

1. **Stop Patroni**
2. **Restore dump**
   ```bash
   psql -f backup.sql postgres
   ```

## Related Documentation

- [PostgreSQL Patroni](../04-services/postgresql-patroni.md)
- [Databases Layer](../03-layers/databases.md)
- [Incident Response](./incident-response.md)
