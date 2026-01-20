# Incident Response

Procedures for handling security and availability incidents.

## Overview

This runbook covers:
- Incident classification
- Response procedures
- Communication templates
- Post-incident review

## Incident Classification

| Severity | Description | Response Time | Examples |
|----------|-------------|---------------|----------|
| P1 | Critical | Immediate | Complete outage, security breach |
| P2 | Major | < 30 min | Partial outage, data corruption |
| P3 | Minor | < 4 hours | Performance degradation |
| P4 | Low | Next business day | Cosmetic issues |

## Initial Response

### 1. Acknowledge

```
Incident acknowledged at [TIME]
Severity: P[X]
Responder: [NAME]
```

### 2. Assess

- What is the impact?
- What services are affected?
- How many users impacted?

### 3. Communicate

Notify stakeholders based on severity:

| Severity | Notify |
|----------|--------|
| P1 | All stakeholders, management |
| P2 | Technical leads, on-call |
| P3 | Team channel |
| P4 | Ticket only |

## Security Incident Procedure

### Containment

1. **Isolate affected systems**
   ```bash
   # Block at firewall
   configure
   set firewall name BLOCKED rule 10 action drop
   set firewall name BLOCKED rule 10 source address <IP>
   commit
   ```

2. **Preserve evidence**
   ```bash
   # Snapshot affected VMs
   qm snapshot <vm_id> incident-$(date +%Y%m%d)
   ```

3. **Revoke compromised credentials**
   ```bash
   vault token revoke <token>
   ```

### Investigation

1. **Check Wazuh alerts**
   ```
   Access Wazuh dashboard
   Filter by affected host
   ```

2. **Review logs**
   ```bash
   # In Grafana/Loki
   {host="affected-host"} |= "error"
   ```

3. **Check audit logs**
   ```bash
   journalctl -u sshd --since "1 hour ago"
   ```

### Remediation

1. **Patch vulnerabilities**
2. **Reset credentials**
3. **Restore from clean backup if needed**
4. **Remove isolation**

## Availability Incident Procedure

### Diagnose

1. **Check monitoring**
   ```
   Access Grafana dashboard
   Check alerting status
   ```

2. **Identify root cause**
   ```bash
   # Check recent changes
   soverstack state show
   git log --since="1 hour ago"
   ```

### Resolve

1. **Apply fix or rollback**
   ```bash
   soverstack state rollback --to <state-id>
   ```

2. **Verify service restored**
   ```bash
   soverstack status
   ```

### Communicate Resolution

```
Incident resolved at [TIME]
Root cause: [DESCRIPTION]
Resolution: [ACTIONS TAKEN]
Duration: [TIME]
```

## Post-Incident Review

Within 48 hours of P1/P2 incidents:

### Template

```markdown
# Incident Review: [TITLE]

## Summary
- Date: [DATE]
- Duration: [TIME]
- Severity: P[X]
- Impact: [DESCRIPTION]

## Timeline
- [TIME] - Incident detected
- [TIME] - Response started
- [TIME] - Root cause identified
- [TIME] - Fix applied
- [TIME] - Service restored

## Root Cause
[DETAILED EXPLANATION]

## Action Items
- [ ] [ACTION 1] - Owner: [NAME]
- [ ] [ACTION 2] - Owner: [NAME]

## Lessons Learned
[WHAT WE LEARNED]
```

## Related Documentation

- [Wazuh SIEM](../04-services/wazuh-siem.md)
- [Alertmanager](../04-services/alertmanager.md)
- [Emergency Access](./emergency-access.md)
