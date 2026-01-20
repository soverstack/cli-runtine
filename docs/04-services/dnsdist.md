# dnsdist

dnsdist provides DNS load balancing, caching, and query routing.

## Overview

```
┌─────────────────────────────────────────────────────────┐
│                   dnsdist Architecture                   │
│                                                          │
│   ┌─────────┐     ┌─────────┐                           │
│   │ Client  │     │ Client  │                           │
│   └────┬────┘     └────┬────┘                           │
│        │               │                                 │
│        └───────┬───────┘                                │
│                │                                         │
│         ┌──────▼──────┐                                 │
│         │   dnsdist   │◄── Cache + Rate Limiting        │
│         │  (Frontend) │                                  │
│         └──────┬──────┘                                 │
│                │                                         │
│    ┌───────────┼───────────┐                            │
│    │           │           │                            │
│    ▼           ▼           ▼                            │
│ ┌──────┐  ┌──────┐   ┌───────────┐                     │
│ │PDNS-1│  │PDNS-2│   │  Upstream │                     │
│ │ (Auth)│  │ (Auth)│   │   (Recur) │                     │
│ └──────┘  └──────┘   └───────────┘                     │
└─────────────────────────────────────────────────────────┘
```

## Configuration

Defined in [`networking.yaml`](../03-layers/networking.md) under `dns_load_balancer`:

```yaml
dns_load_balancer:
  enabled: true
  type: dnsdist
  vm_ids: [50, 51]
  public_ip:
    ip: "203.0.113.2"
    vrrp_id: 20
  backends:
    - address: "10.0.1.70"
      port: 53
      weight: 100
    - address: "10.0.1.71"
      port: 53
      weight: 100
  upstream_resolvers:
    - "1.1.1.1"
    - "8.8.8.8"
```

## VM Specifications

| Tier | vCPU | RAM | Disk | Count |
|------|------|-----|------|-------|
| local | 1 | 1 GB | 10 GB | 1 |
| production | 2 | 2 GB | 10 GB | 2 |
| enterprise | 2 | 4 GB | 10 GB | 2 |

## Features

### Load Balancing Algorithms

| Algorithm | Description | Use Case |
|-----------|-------------|----------|
| `roundrobin` | Equal distribution | Default |
| `leastOutstanding` | Least pending queries | High traffic |
| `whashed` | Weighted hash | Consistent routing |
| `chashed` | Consistent hash | Cache affinity |

### Query Routing

```lua
-- Route by domain
addAction({"example.com", "example.org"}, PoolAction("authoritative"))
addAction(AllRule(), PoolAction("recursive"))
```

### Rate Limiting

```yaml
dns_load_balancer:
  rate_limiting:
    enabled: true
    qps: 100              # Queries per second
    burst: 50             # Burst allowance
    action: drop          # drop, delay, or truncate
```

### Caching

```yaml
dns_load_balancer:
  cache:
    enabled: true
    size: 100000          # Max cached entries
    ttl:
      min: 60
      max: 86400
    negative_ttl: 60
```

## High Availability

dnsdist HA with VRRP:

```
┌─────────────────────────────────────────┐
│           Floating IP (VIP)             │
│              203.0.113.2                │
└─────────────────┬───────────────────────┘
                  │
      ┌───────────┴───────────┐
      │                       │
┌─────▼─────┐          ┌─────▼─────┐
│ dnsdist-1 │◄─ VRRP ─►│ dnsdist-2 │
│  (Master) │          │  (Backup) │
└───────────┘          └───────────┘
```

## Security Features

### DNS-over-HTTPS (DoH)

```yaml
dns_load_balancer:
  doh:
    enabled: true
    certificate: /etc/ssl/dns/cert.pem
    key: /etc/ssl/dns/key.pem
    path: /dns-query
```

### DNS-over-TLS (DoT)

```yaml
dns_load_balancer:
  dot:
    enabled: true
    certificate: /etc/ssl/dns/cert.pem
    key: /etc/ssl/dns/key.pem
```

### Query Filtering

```lua
-- Block malicious domains
addAction(SuffixMatchNodeRule({"malware.com", "phishing.net"}), DropAction())

-- Log suspicious queries
addAction(QTypeRule(DNSQType.ANY), LogAction("/var/log/dnsdist/any-queries.log"))
```

## Monitoring

Exported metrics:

| Metric | Description |
|--------|-------------|
| `dnsdist_queries` | Total queries |
| `dnsdist_responses` | Total responses |
| `dnsdist_cache_hits` | Cache hit ratio |
| `dnsdist_latency` | Average latency |
| `dnsdist_downstream_timeouts` | Backend timeouts |

### Web Dashboard

```yaml
dns_load_balancer:
  console:
    enabled: true
    address: "127.0.0.1:8083"
    api_key: "${DNSDIST_API_KEY}"
```

## Troubleshooting

### Check Status

```bash
# Connect to console
dnsdist -c

# Show pools
showPools()

# Show servers
showServers()

# Show cache stats
showCacheStats()
```

### Test Resolution

```bash
# Query through dnsdist
dig @10.0.1.50 example.com

# Check latency
dig @10.0.1.50 example.com +stats
```

### View Logs

```bash
journalctl -u dnsdist
tail -f /var/log/dnsdist/query.log
```

## See Also

- [PowerDNS](powerdns.md)
- [Networking Layer](../03-layers/networking.md)
- [Security Model](../02-architecture/security-model.md)
