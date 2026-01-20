# Wazuh SIEM

Wazuh provides security information and event management (SIEM) capabilities.

## Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Wazuh Architecture                        │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │   Wazuh      │  │   Wazuh      │  │   Wazuh      │       │
│  │  Manager 1   │  │  Manager 2   │  │  Indexer     │       │
│  │  (vm_id:370) │  │  (vm_id:371) │  │  (vm_id:372) │       │
│  └──────┬───────┘  └──────┬───────┘  └──────────────┘       │
│         │                 │                                  │
│         └────────┬────────┘                                  │
│                  ▼                                           │
│    ┌─────────────────────────────────────┐                  │
│    │         Wazuh Agents                │                  │
│    │  • All VMs                          │                  │
│    │  • Kubernetes nodes                 │                  │
│    │  • Proxmox hosts                    │                  │
│    └─────────────────────────────────────┘                  │
└─────────────────────────────────────────────────────────────┘
```

## VM ID Range

Wazuh VMs must use IDs in the **SIEM** range:

| Range | Min | Max | Description |
|-------|-----|-----|-------------|
| SIEM | 370 | 399 | Wazuh, Falco |

## Features

### Threat Detection
- File integrity monitoring
- Rootkit detection
- Vulnerability scanning

### Log Analysis
- Security event correlation
- Compliance reporting
- Custom rule creation

### Active Response
- Automated threat response
- IP blocking
- Service restart

## Compliance

| Framework | Coverage |
|-----------|----------|
| PCI DSS | Log retention, access control |
| HIPAA | Audit trails, encryption |
| SOC 2 | Security monitoring |
| GDPR | Data protection monitoring |

## Related Documentation

- [Observability Layer](../03-layers/observability.md)
- [Security Model](../02-architecture/security-model.md)
- [Incident Response Runbook](../07-runbooks/incident-response.md)
