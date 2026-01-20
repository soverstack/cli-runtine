---
id: runbooks
title: Runbooks
sidebar_position: 1
---

# Runbooks

Step-by-step procedures for common operational tasks and incident response.

## Contents

1. [Emergency Access](./emergency-access.md) - Regaining access in emergencies
2. [Database Failover](./database-failover.md) - PostgreSQL failover procedures
3. [Cluster Recovery](./cluster-recovery.md) - Kubernetes cluster recovery
4. [Secret Rotation](./secret-rotation.md) - Rotating secrets and credentials
5. [Incident Response](./incident-response.md) - Handling incidents

## Runbook Format

Each runbook follows this structure:

1. **Overview** - What the runbook covers
2. **Prerequisites** - What you need before starting
3. **Procedure** - Step-by-step instructions
4. **Verification** - How to verify success
5. **Rollback** - How to undo if needed

## Severity Levels

| Level | Description | Response Time |
|-------|-------------|---------------|
| P1 | Critical - Complete outage | Immediate |
| P2 | Major - Partial outage | < 30 min |
| P3 | Minor - Degraded service | < 4 hours |
| P4 | Low - Cosmetic issues | Next business day |
