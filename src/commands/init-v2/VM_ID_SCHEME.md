# VM ID Numbering Scheme

Soverstack uses a deterministic, hierarchical VM ID scheme. Every VM ID encodes its scope, region, datacenter, role, and instance — making it collision-free and human-readable.

## Formula

```
vm_id = SCOPE_BASE + regionId × 100,000 + dcId × 1,000 + ROLE_OFFSET + instance
```

| Scope    | Formula                                               | Example            |
|----------|-------------------------------------------------------|--------------------|
| Global   | `1000 + roleOffset + instance`                        | `1200` = database  |
| Regional | `regionId × 100000 + roleOffset + instance`           | `100050` = eu logs |
| Zonal    | `regionId × 100000 + dcId × 1000 + roleOffset + inst` | `102050` = eu/zone-paris lb |

## Parameters

| Parameter  | Description                                | Range      |
|------------|--------------------------------------------|------------|
| `regionId` | 1-based index of the region                | 1–99       |
| `dcId`     | 0 = regional services, 1+ = datacenters   | 0–99       |
| `instance` | 0-based instance index within a role       | 0–49       |

Datacenter ordering within a region: hubs first (index 1+), then zones.

## Role Offsets (step of 50)

### Global (base: 1000)

| Role               | Offset | Range       |
|--------------------|--------|-------------|
| dns-authoritative  | +0     | 1000–1049   |
| dns-loadbalancer   | +50    | 1050–1099   |
| secrets            | +100   | 1100–1149   |
| identity           | +150   | 1150–1199   |
| database           | +200   | 1200–1249   |
| mesh               | +250   | 1250–1299   |
| *(reserved)*       | +300   | 1300–1499   |

### Regional (per region, 500 IDs each)

| Role       | Offset | Example (eu, regionId=1) |
|------------|--------|--------------------------|
| metrics    | +0     | 100000–100049            |
| logs       | +50    | 100050–100099            |
| alerting   | +100   | 100100–100149            |
| dashboards | +150   | 100150–100199            |
| bastion    | +200   | 100200–100249            |
| siem       | +250   | 100250–100299            |
| *(reserved)* | +300 | 100300–100499            |

### Zonal (per datacenter, 500 IDs each)

| Role (zone)   | Offset | Example (eu/zone-paris, dc=2) |
|---------------|--------|-------------------------------|
| firewall      | +0     | 102000–102049                 |
| loadbalancer  | +50    | 102050–102099                 |
| *(reserved)*  | +100   | 102100–102499                 |

| Role (hub)    | Offset | Example (eu/hub-eu, dc=1)     |
|---------------|--------|-------------------------------|
| storage       | +0     | 101000–101049                 |
| backup        | +50    | 101050–101099                 |
| *(reserved)*  | +100   | 101100–101499                 |

## Reading a VM ID

```
  102051
  │  │ └┘── instance 1
  │  │ ── offset 50 = loadbalancer
  │  └┘── dc 02 = zone-paris
  └───── region 1 = eu

  200050
  │  │ └┘── instance 0
  │  │ ── offset 50 = logs
  │  └┘── dc 00 = regional services
  └───── region 2 = asia

  1201
    └┘└── global, offset 200 = database, instance 1
```

## Full Example

Topology: eu (region 1), asia (region 2)
- eu: hub-eu (dc 1), zone-paris (dc 2), zone-nrb (dc 3)
- asia: zone-phil (dc 1) — uses hub-eu (shared)

```
GLOBAL (1000)
  dns-authoritative:  1000, 1001
  dns-loadbalancer:   1050, 1051
  secrets:            1100, 1101, 1102
  identity:           1150, 1151
  database:           1200, 1201, 1202
  mesh:               1250, 1251

EU — REGIONAL (100000)
  metrics:     100000, 100001
  logs:        100050, 100051
  alerting:    100100, 100101
  dashboards:  100150
  bastion:     100200, 100201
  siem:        100250, 100251

EU — ZONAL
  hub-eu (101xxx):
    storage:      101000, 101001
    backup:       101050

  zone-paris (102xxx):
    firewall:     102000, 102001
    loadbalancer: 102050, 102051

  zone-nrb (103xxx):
    firewall:     103000, 103001
    loadbalancer: 103050, 103051

ASIA — REGIONAL (200000)
  metrics:     200000, 200001
  logs:        200050, 200051
  alerting:    200100, 200101
  bastion:     200200, 200201
  siem:        200250, 200251

ASIA — ZONAL
  zone-phil (201xxx):
    firewall:     201000, 201001
    loadbalancer: 201050, 201051
```

## Capacity

| Dimension          | Max   | Calculation             |
|--------------------|-------|-------------------------|
| Regions            | 99    | regionId 1–99           |
| DCs per region     | 99    | dcId 1–99 (0=regional)  |
| Roles per block    | 10    | 500 / 50                |
| Instances per role | 50    | offset step             |
| Applications       | 50000+| Reserved for user VMs   |

## Adding New Roles

To add a new role to a scope, assign the next available offset (+300, +350, etc.). There are 4 reserved slots per scope block.
