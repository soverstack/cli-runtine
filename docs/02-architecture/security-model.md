# Security Model

Soverstack implements a zero-trust security architecture.

## Zero-Trust Principles

1. **Never trust, always verify** - All access requires authentication
2. **Least privilege** - Minimal permissions for each service
3. **Assume breach** - Defense in depth at every layer
4. **Verify explicitly** - Continuous validation of identity and context

## Security Layers

```
┌─────────────────────────────────────────────────────────────┐
│                     APPLICATION LAYER                        │
│  • App-level authentication   • Input validation            │
│  • Authorization policies     • Audit logging               │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                      IDENTITY LAYER                          │
│  • Keycloak SSO              • OIDC/SAML                    │
│  • MFA enforcement           • Session management           │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                      SECRETS LAYER                           │
│  • OpenBao/Vault             • Dynamic secrets              │
│  • Encryption keys           • Certificate management       │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                      NETWORK LAYER                           │
│  • VyOS Firewall             • VPN-only access              │
│  • Network segmentation      • TLS everywhere               │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                   INFRASTRUCTURE LAYER                       │
│  • Disk encryption           • Secure boot                  │
│  • Host hardening            • Vulnerability scanning       │
└─────────────────────────────────────────────────────────────┘
```

## Authentication

### VPN Access (Headscale)

```
User → Headscale → OIDC Auth (Keycloak) → MFA → VPN Access
```

- **OIDC enforced**: Cannot be disabled (`oidc_enforced: true`)
- **MFA required**: Configured in Keycloak
- **Device trust**: Tailscale machine authentication

### Service Access

| Service | Auth Method | MFA |
|---------|-------------|-----|
| Grafana | OIDC (Keycloak) | Yes |
| Prometheus | OIDC (Keycloak) | Yes |
| ArgoCD | OIDC (Keycloak) | Yes |
| K8s Dashboard | OIDC (Keycloak) | Yes |
| PostgreSQL | Certificate + Password | N/A |

## Secrets Management

### CredentialRef Types

All secrets use the [`CredentialRef`](../08-reference/types/CredentialRef.md) type:

```typescript
type CredentialRef =
  | { type: "vault"; path: string }      // OpenBao/Vault
  | { type: "env"; var_name: string }    // Environment variable
  | { type: "file"; path: string };      // File on disk
```

### Best Practices

| Method | Use Case | Security Level |
|--------|----------|----------------|
| `vault` | Production secrets | ⭐⭐⭐ Highest |
| `env` | CI/CD, development | ⭐⭐ Medium |
| `file` | Local development | ⭐ Lowest |

### Example

```yaml
# ✅ Good - Using Vault
credentials:
  type: vault
  path: secret/data/postgres/admin

# ✅ OK - Using environment variable
credentials:
  type: env
  var_name: POSTGRES_PASSWORD

# ⚠️ Avoid in production - File-based
credentials:
  type: file
  path: /secrets/postgres-password
```

## Network Security

### VPN-Only Access

All internal services require VPN access:

```yaml
# platform.yaml features
accessible_outside_vpn: false  # Default for all services
```

Services that MAY be accessible outside VPN:
- Public websites (through ingress)
- API endpoints (with proper auth)

### Firewall Rules

Default deny with explicit allows:

```
WAN → DMZ: HTTPS (443), VPN (41641)
WAN → *: DENY
DMZ → Services: Specific ports only
Services → Services: Allowed (internal)
* → Database: Services VLAN only
```

### TLS Configuration

| Component | TLS Version | Certificates |
|-----------|-------------|--------------|
| Ingress | 1.3 | Let's Encrypt / Custom CA |
| Internal | 1.2+ | Internal CA |
| Database | 1.2+ | Internal CA |

## Data Protection

### Encryption at Rest

| Component | Encryption |
|-----------|------------|
| Disk | LUKS (optional) |
| Ceph | RBD encryption |
| Database | PostgreSQL TDE |
| Secrets | OpenBao sealed |

### Encryption in Transit

| Path | Encryption |
|------|------------|
| External | TLS 1.3 |
| Internal | mTLS |
| Database | SSL required |
| Ceph | Encrypted messenger |

## Audit & Compliance

### Logging

All security events logged to:
- **Loki**: Centralized log aggregation
- **Wazuh**: SIEM analysis

### Audit Trail

| Event | Logged |
|-------|--------|
| Authentication attempts | ✅ |
| Authorization decisions | ✅ |
| Secret access | ✅ |
| Configuration changes | ✅ |
| Network connections | ✅ |

### Compliance Features

| Framework | Support |
|-----------|---------|
| SOC 2 | Audit logging, access controls |
| GDPR | Data encryption, access logs |
| HIPAA | Encryption, audit trails |
| PCI DSS | Network segmentation, encryption |

## Security Validation

Soverstack validates security configuration:

```bash
soverstack validate
```

### Validation Rules

| Rule | Tier | Severity |
|------|------|----------|
| Plain text passwords | All | Critical |
| OIDC disabled | All | Critical |
| SSL disabled | Production+ | Error |
| VPN access disabled | Production+ | Warning |
| Missing backup encryption | Enterprise | Error |

## Incident Response

See [Incident Response Runbook](../07-runbooks/incident-response.md)

## See Also

- [OpenBao Secrets](../04-services/openbao-secrets.md)
- [Keycloak IAM](../04-services/keycloak-iam.md)
- [VyOS Firewall](../04-services/vyos-firewall.md)
- [Wazuh SIEM](../04-services/wazuh-siem.md)
