# PowerDNS

PowerDNS provides authoritative DNS for your domain with PostgreSQL backend.

## Overview

```
┌─────────────────────────────────────────────────────────┐
│                  DNS Architecture                        │
│                                                          │
│   External Query                Internal Query           │
│        │                              │                  │
│        ▼                              ▼                  │
│   ┌─────────┐                   ┌─────────┐             │
│   │ dnsdist │                   │ dnsdist │             │
│   │  (LB)   │                   │ (Cache) │             │
│   └────┬────┘                   └────┬────┘             │
│        │                              │                  │
│        └──────────┬───────────────────┘                 │
│                   │                                      │
│           ┌───────▼───────┐                             │
│           │   PowerDNS    │──────► PostgreSQL           │
│           │ (Authoritative)│       (Zone Storage)       │
│           └───────────────┘                             │
└─────────────────────────────────────────────────────────┘
```

## Configuration

Defined in [`networking.yaml`](../03-layers/networking.md) under `dns`:

```yaml
dns:
  provider: powerdns
  vm_ids: [70, 71]
  database: powerdns          # Reference to databases layer

  zones:
    - name: "example.com"
      type: master
    - name: "10.in-addr.arpa"
      type: master
```

## VM Specifications

| Tier | vCPU | RAM | Disk | Count |
|------|------|-----|------|-------|
| local | 1 | 1 GB | 10 GB | 1 |
| production | 2 | 2 GB | 20 GB | 2 |
| enterprise | 2 | 4 GB | 20 GB | 2 |

## Features

### Zone Management

| Zone Type | Description |
|-----------|-------------|
| `master` | Primary zone, editable |
| `slave` | Secondary zone, replicated |
| `native` | No zone transfers (recommended) |

### Record Types

| Type | Purpose | Example |
|------|---------|---------|
| A | IPv4 address | `app.example.com → 10.0.1.100` |
| AAAA | IPv6 address | `app.example.com → 2001:db8::1` |
| CNAME | Alias | `www → app.example.com` |
| MX | Mail exchange | `mail.example.com` |
| TXT | Text records | SPF, DKIM |
| SRV | Service location | `_http._tcp.example.com` |
| PTR | Reverse DNS | `100.1.0.10.in-addr.arpa` |

### Auto-Generated Records

Soverstack automatically creates:

| Service | Record |
|---------|--------|
| Grafana | `grafana.example.com` |
| Prometheus | `prometheus.example.com` |
| Keycloak | `auth.example.com` |
| Vault | `vault.example.com` |
| ArgoCD | `argocd.example.com` |
| VPN | `vpn.example.com` |

## Database Schema

PowerDNS uses PostgreSQL for zone storage:

```sql
-- Domains table
CREATE TABLE domains (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(6) NOT NULL,
  master VARCHAR(255),
  notified_serial INT
);

-- Records table
CREATE TABLE records (
  id SERIAL PRIMARY KEY,
  domain_id INT REFERENCES domains(id),
  name VARCHAR(255),
  type VARCHAR(10),
  content VARCHAR(65535),
  ttl INT,
  prio INT
);
```

## API Access

PowerDNS provides a REST API:

```bash
# List zones
curl -H "X-API-Key: $PDNS_API_KEY" \
  http://powerdns.internal:8081/api/v1/servers/localhost/zones

# Create record
curl -X PATCH -H "X-API-Key: $PDNS_API_KEY" \
  -d '{"rrsets": [{"name": "test.example.com.", "type": "A", "ttl": 300, "changetype": "REPLACE", "records": [{"content": "10.0.1.50", "disabled": false}]}]}' \
  http://powerdns.internal:8081/api/v1/servers/localhost/zones/example.com.
```

## DNSSEC (Enterprise)

DNSSEC signing for zone integrity:

```yaml
dns:
  dnssec:
    enabled: true
    algorithm: ECDSAP256SHA256
    nsec3: true
```

## High Availability

PowerDNS HA with native replication:

1. Both servers read from PostgreSQL
2. PostgreSQL handles replication
3. dnsdist load balances queries
4. No AXFR needed

## Monitoring

Exported metrics:

| Metric | Description |
|--------|-------------|
| `pdns_queries_total` | Total queries |
| `pdns_cache_hits` | Cache hit ratio |
| `pdns_latency_seconds` | Query latency |
| `pdns_packetcache_size` | Cache size |

## Troubleshooting

### Check Zone

```bash
pdnsutil list-zone example.com
pdnsutil check-zone example.com
```

### Query Test

```bash
dig @localhost example.com SOA
dig @localhost grafana.example.com A
```

### View Logs

```bash
journalctl -u pdns
```

## See Also

- [dnsdist Load Balancer](dnsdist.md)
- [Networking Layer](../03-layers/networking.md)
- [PostgreSQL](postgresql-patroni.md)
