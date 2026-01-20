# Cluster Recovery

Procedures for Kubernetes cluster recovery.

## Overview

This runbook covers:
- Control plane recovery
- Worker node recovery
- etcd recovery
- Full cluster rebuild

## Prerequisites

- SSH access to cluster nodes
- Velero backups available
- Understanding of K8s architecture

## Scenario 1: Single Master Failure

### Symptoms
- One master node unreachable
- Cluster still functional
- kubectl works

### Procedure

1. **Check cluster status**
   ```bash
   kubectl get nodes
   ```

2. **Remove failed node**
   ```bash
   kubectl delete node master-1
   ```

3. **Replace VM in Soverstack**
   ```bash
   soverstack apply --layer cluster
   ```

4. **Rejoin node to cluster**
   ```bash
   kubeadm join --control-plane ...
   ```

### Verification
- All 3 masters running
- etcd cluster healthy
- API server responding

## Scenario 2: Control Plane Quorum Lost

### Symptoms
- Multiple masters down
- kubectl not responding
- etcd has no quorum

### Procedure

1. **Identify surviving etcd member**
   ```bash
   ETCDCTL_API=3 etcdctl member list
   ```

2. **Restore etcd from backup**
   ```bash
   ETCDCTL_API=3 etcdctl snapshot restore backup.db
   ```

3. **Start etcd with restored data**
   ```bash
   systemctl start etcd
   ```

4. **Restart kube-apiserver**
   ```bash
   systemctl restart kube-apiserver
   ```

5. **Rejoin other masters**
   ```bash
   kubeadm join --control-plane ...
   ```

### Verification
- etcd cluster has quorum
- API server responding
- All masters healthy

## Scenario 3: Worker Node Failure

### Symptoms
- Worker node NotReady
- Pods being rescheduled

### Procedure

1. **Check node status**
   ```bash
   kubectl describe node worker-1
   ```

2. **Drain node (if partially working)**
   ```bash
   kubectl drain worker-1 --ignore-daemonsets --delete-emptydir-data
   ```

3. **Replace VM**
   ```bash
   soverstack apply --layer cluster
   ```

4. **Verify node ready**
   ```bash
   kubectl get nodes
   ```

### Verification
- Node shows Ready
- Pods scheduling on new node
- No pending pods

## Scenario 4: Full Cluster Rebuild

### When to Use
- Complete cluster failure
- Disaster recovery
- Major upgrade

### Procedure

1. **Ensure backups available**
   ```bash
   velero backup get
   ```

2. **Rebuild cluster infrastructure**
   ```bash
   soverstack apply --layer cluster --force
   ```

3. **Wait for cluster ready**
   ```bash
   kubectl get nodes
   ```

4. **Restore from Velero backup**
   ```bash
   velero restore create --from-backup latest-backup
   ```

5. **Verify applications**
   ```bash
   kubectl get pods --all-namespaces
   ```

### Verification
- All nodes ready
- All namespaces restored
- Applications running
- Data intact

## Related Documentation

- [Cluster Architecture](../05-kubernetes/cluster-architecture.md)
- [Velero Backup](../05-kubernetes/velero-backup.md)
- [Incident Response](./incident-response.md)
