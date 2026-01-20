---
id: dns-config
title: DNSConfig
sidebar_position: 40
---

# DNSConfig

Configuration DNS pour PowerDNS ou Cloudflare.

## Structure

```yaml
# Dans networking.yaml
dns:
  type: powerdns                     # powerdns, cloudflare ou hybrid
  deployment: vm                     # vm ou cluster

  powerdns:                          # si type: powerdns ou hybrid
    vm_ids: [70, 71, 72]
    loadbalancer_vm_ids: [50, 51]    # optionnel - dnsdist
    database: core-cluster

  cloudflare:                        # si type: cloudflare ou hybrid
    mode: proxy                      # proxy ou dns_only
    credentials:
      type: vault
      path: secret/cloudflare/api

  zones:
    - domain: example.com
      type: primary
      nameservers:
        - ns1.example.com
        - ns2.example.com
      glue_records:
        ns1: "203.0.113.2"
        ns2: "203.0.113.3"

    - domain: internal.local
      type: primary
      internal: true
```

## Propriétés

| Propriété | Type | Requis | Description |
|-----------|------|--------|-------------|
| `type` | `powerdns`, `cloudflare` ou `hybrid` | Oui | Type de provider DNS |
| `deployment` | `vm` ou `cluster` | Oui | Mode de déploiement |
| `powerdns` | objet | Non | Configuration PowerDNS |
| `cloudflare` | objet | Non | Configuration Cloudflare |
| `zones` | liste de DNSZone | Oui | Zones DNS |

## Objet powerdns

| Propriété | Type | Requis | Description |
|-----------|------|--------|-------------|
| `vm_ids` | liste de nombres | Oui | IDs des VMs PowerDNS |
| `loadbalancer_vm_ids` | liste de nombres | Non | IDs des VMs dnsdist |
| `database` | texte | Oui | Référence au cluster de base de données |

## Objet cloudflare

| Propriété | Type | Requis | Description |
|-----------|------|--------|-------------|
| `mode` | `proxy` ou `dns_only` | Oui | Mode Cloudflare |
| `credentials` | [CredentialRef](./CredentialRef.md) | Oui | Credentials API |

## Objet DNSZone

| Propriété | Type | Requis | Description |
|-----------|------|--------|-------------|
| `domain` | texte | Oui | Nom de domaine |
| `type` | `primary` ou `secondary` | Oui | Type de zone |
| `internal` | booléen | Non | Zone interne uniquement |
| `nameservers` | liste de textes | Non | Enregistrements nameserver |
| `glue_records` | map | Non | Glue records |

## Plages d'ID VM

| Rôle | Plage | Description |
|------|-------|-------------|
| dns_lb (dnsdist) | 50-69 | Load balancer DNS |
| dns_server (PowerDNS) | 70-99 | Serveur DNS autoritaire |

## Voir aussi

- [NetworkingConfig](./NetworkingConfig.md)
- [CredentialRef](./CredentialRef.md)
