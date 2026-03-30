/**
 * Tests for init/types.ts — helpers, VM ID scheme, implementations
 */

import {
  vmId,
  GLOBAL_BASE,
  REGION_BLOCK,
  DC_BLOCK,
  ROLE_OFFSETS,
  IMPLEMENTATIONS,
  DEFAULT_IMPLEMENTATIONS,
  VERSION_CATALOG,
  getVersionInfo,
  versionLine,
  implLine,
  regionOwnsHub,
  getDatacenters,
  getHubName,
  getZoneFullName,
  RegionConfig,
} from "../types";

// ════════════════════════════════════════════════════════════════════════════
// VM ID SCHEME
// ════════════════════════════════════════════════════════════════════════════

describe("vmId", () => {
  test("global scope uses GLOBAL_BASE", () => {
    expect(vmId("global", 0, 0, "database", 0)).toBe(GLOBAL_BASE + ROLE_OFFSETS.database);
    expect(vmId("global", 0, 0, "database", 0)).toBe(1200);
  });

  test("global scope ignores regionId and dcId", () => {
    expect(vmId("global", 5, 3, "database", 0)).toBe(vmId("global", 0, 0, "database", 0));
  });

  test("global instances increment by 1", () => {
    expect(vmId("global", 0, 0, "database", 0)).toBe(1200);
    expect(vmId("global", 0, 0, "database", 1)).toBe(1201);
    expect(vmId("global", 0, 0, "database", 2)).toBe(1202);
  });

  test("global roles have different offsets", () => {
    const dnsAuth = vmId("global", 0, 0, "dns-authoritative", 0);
    const dnsLb = vmId("global", 0, 0, "dns-loadbalancer", 0);
    const secrets = vmId("global", 0, 0, "secrets", 0);
    expect(dnsAuth).toBe(1000);
    expect(dnsLb).toBe(1050);
    expect(secrets).toBe(1100);
    // No overlap
    expect(dnsLb - dnsAuth).toBe(50);
    expect(secrets - dnsLb).toBe(50);
  });

  test("regional scope encodes regionId", () => {
    // eu = region 1, dcId = 0 (regional)
    expect(vmId("regional", 1, 0, "metrics", 0)).toBe(100000);
    // asia = region 2
    expect(vmId("regional", 2, 0, "metrics", 0)).toBe(200000);
    // region 10
    expect(vmId("regional", 10, 0, "metrics", 0)).toBe(1000000);
  });

  test("regional roles offset correctly", () => {
    expect(vmId("regional", 1, 0, "metrics", 0)).toBe(100000);
    expect(vmId("regional", 1, 0, "logs", 0)).toBe(100050);
    expect(vmId("regional", 1, 0, "alerting", 0)).toBe(100100);
    expect(vmId("regional", 1, 0, "bastion", 0)).toBe(100200);
  });

  test("zonal scope encodes regionId and dcId", () => {
    // eu/hub-eu = region 1, dc 1
    expect(vmId("zonal", 1, 1, "storage", 0)).toBe(101000);
    // eu/zone-paris = region 1, dc 2
    expect(vmId("zonal", 1, 2, "firewall", 0)).toBe(102000);
    // asia/zone-phil = region 2, dc 1
    expect(vmId("zonal", 2, 1, "firewall", 0)).toBe(201000);
  });

  test("zonal instances increment", () => {
    expect(vmId("zonal", 1, 2, "firewall", 0)).toBe(102000);
    expect(vmId("zonal", 1, 2, "firewall", 1)).toBe(102001);
  });

  test("no collisions between scopes", () => {
    const globalMax = GLOBAL_BASE + 499; // 1499
    const regionalMin = vmId("regional", 1, 0, "metrics", 0); // 100000
    expect(regionalMin).toBeGreaterThan(globalMax);
  });

  test("no collisions between regions", () => {
    const euMax = vmId("regional", 1, 0, "siem", 49); // 100299
    const asiaMin = vmId("regional", 2, 0, "metrics", 0); // 200000
    expect(asiaMin).toBeGreaterThan(euMax);
  });

  test("no collisions between DCs in same region", () => {
    const dc1Max = vmId("zonal", 1, 1, "loadbalancer", 49); // 101099
    const dc2Min = vmId("zonal", 1, 2, "firewall", 0); // 102000
    expect(dc2Min).toBeGreaterThan(dc1Max);
  });

  test("reading a VM ID — region 1, dc 2, loadbalancer instance 1", () => {
    const id = vmId("zonal", 1, 2, "loadbalancer", 1);
    expect(id).toBe(102051);
    // Decode: 1 = region, 02 = dc, 051 = offset 50 + instance 1
  });
});

// ════════════════════════════════════════════════════════════════════════════
// IMPLEMENTATIONS
// ════════════════════════════════════════════════════════════════════════════

describe("IMPLEMENTATIONS", () => {
  test("every role has at least 2 implementations", () => {
    for (const [role, impls] of Object.entries(IMPLEMENTATIONS)) {
      expect(impls.length).toBeGreaterThanOrEqual(2);
    }
  });

  test("every role has a default", () => {
    for (const role of Object.keys(IMPLEMENTATIONS)) {
      expect(DEFAULT_IMPLEMENTATIONS[role]).toBeDefined();
      expect(IMPLEMENTATIONS[role]).toContain(DEFAULT_IMPLEMENTATIONS[role]);
    }
  });

  test("VERSION_CATALOG has entry for every default implementation", () => {
    for (const impl of Object.values(DEFAULT_IMPLEMENTATIONS)) {
      const info = getVersionInfo(impl);
      expect(info.current).toBeTruthy();
      expect(info.supported.length).toBeGreaterThan(0);
    }
  });
});

// ════════════════════════════════════════════════════════════════════════════
// VERSION / IMPL LINE GENERATORS
// ════════════════════════════════════════════════════════════════════════════

describe("versionLine", () => {
  test("generates version with supported comment", () => {
    const line = versionLine("postgresql");
    expect(line).toContain("version:");
    expect(line).toContain("16");
    expect(line).toContain("# Supported:");
  });

  test("uses 4-space indent by default", () => {
    const line = versionLine("postgresql");
    expect(line).toMatch(/^    version:/);
  });
});

describe("implLine", () => {
  test("generates implementation with alternatives comment", () => {
    const line = implLine("database");
    expect(line).toContain("implementation: postgresql");
    expect(line).toContain("# postgresql | mysql | mariadb");
  });

  test("uses default implementation for the role", () => {
    const line = implLine("firewall");
    expect(line).toContain("implementation: vyos");
  });
});

// ════════════════════════════════════════════════════════════════════════════
// REGION HELPERS
// ════════════════════════════════════════════════════════════════════════════

describe("regionOwnsHub", () => {
  test("returns true when hub matches region name", () => {
    expect(regionOwnsHub({ name: "eu", zones: ["paris"], hub: "hub-eu" })).toBe(true);
  });

  test("returns true when no hub set", () => {
    expect(regionOwnsHub({ name: "eu", zones: ["paris"] })).toBe(true);
  });

  test("returns false when hub is from another region", () => {
    expect(regionOwnsHub({ name: "asia", zones: ["phil"], hub: "hub-eu" })).toBe(false);
  });
});

describe("getDatacenters", () => {
  const region: RegionConfig = { name: "eu", zones: ["paris", "nrb"], hub: "hub-eu" };

  test("includes hub when includeHub is true", () => {
    const dcs = getDatacenters(region, true);
    expect(dcs.length).toBe(3); // hub + 2 zones
    expect(dcs[0].type).toBe("hub");
    expect(dcs[0].fullName).toBe("hub-eu");
  });

  test("excludes hub when includeHub is false", () => {
    const dcs = getDatacenters(region, false);
    expect(dcs.length).toBe(2);
    expect(dcs.every((dc) => dc.type === "zone")).toBe(true);
  });

  test("zones have correct fullNames", () => {
    const dcs = getDatacenters(region, false);
    expect(dcs[0].fullName).toBe("zone-paris");
    expect(dcs[1].fullName).toBe("zone-nrb");
  });
});

describe("getHubName", () => {
  test("returns hub name from config", () => {
    expect(getHubName({ name: "eu", zones: ["paris"], hub: "hub-eu" })).toBe("hub-eu");
  });

  test("derives hub name from region when not set", () => {
    expect(getHubName({ name: "us", zones: ["oregon"] })).toBe("hub-us");
  });
});

describe("getZoneFullName", () => {
  test("prefixes zone name", () => {
    expect(getZoneFullName("paris")).toBe("zone-paris");
  });
});
