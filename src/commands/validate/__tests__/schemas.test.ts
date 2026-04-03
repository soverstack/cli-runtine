/**
 * Tests for Zod schemas
 */

import {
  validatePlatformSchema,
  validateRegionSchema,
  validateNodesSchema,
  validateNetworkSchema,
  validateSshSchema,
  validateWorkloadSchema,
} from "../schemas/validate";
import { validateSsh } from "../validators/ssh";

// ════════════════════════════════════════════════════════════════════════════
// PLATFORM
// ════════════════════════════════════════════════════════════════════════════

const validPlatform = {
  project_name: "my-project",
  version: "1.0",
  domain: "example.com",
  infrastructure_tier: "production",
  compliance_level: "startup",
  images: [{ name: "debian-12", url: "https://example.com/img.qcow2", default: true }],
  flavors: [{ name: "small", cpu: 2, ram: 2048, disk: 20 }],
  defaults: { global_placement: { datacenter: "zone-paris" } },
  state: { backend: "local", path: "./.soverstack/state" },
};

describe("PlatformSchema", () => {
  test("valid platform passes", () => {
    const r = validatePlatformSchema(validPlatform);
    expect(r.errors.length).toBe(0);
  });

  test("missing project_name fails", () => {
    const r = validatePlatformSchema({ ...validPlatform, project_name: undefined });
    expect(r.valid).toBe(false);
  });

  test("invalid project_name format fails", () => {
    const r = validatePlatformSchema({ ...validPlatform, project_name: "My Project!" });
    expect(r.valid).toBe(false);
  });

  test("invalid domain fails", () => {
    const r = validatePlatformSchema({ ...validPlatform, domain: "not-a-domain" });
    expect(r.valid).toBe(false);
  });

  test("invalid tier fails", () => {
    const r = validatePlatformSchema({ ...validPlatform, infrastructure_tier: "mega" });
    expect(r.valid).toBe(false);
  });

  test("no images fails", () => {
    const r = validatePlatformSchema({ ...validPlatform, images: [] });
    expect(r.valid).toBe(false);
  });

  test("no default image fails", () => {
    const r = validatePlatformSchema({ ...validPlatform, images: [{ name: "debian-12", url: "https://x.com/a" }] });
    expect(r.valid).toBe(false);
  });

  test("duplicate image names fail", () => {
    const r = validatePlatformSchema({
      ...validPlatform,
      images: [
        { name: "debian-12", url: "https://x.com/a", default: true },
        { name: "debian-12", url: "https://x.com/b" },
      ],
    });
    expect(r.valid).toBe(false);
  });

  test("string cpu in flavor fails", () => {
    const r = validatePlatformSchema({
      ...validPlatform,
      flavors: [{ name: "small", cpu: "2", ram: 2048, disk: 20 }],
    });
    expect(r.valid).toBe(false);
    expect(r.errors[0].message).toContain("cpu");
  });

  test("remote backend without url fails", () => {
    const r = validatePlatformSchema({
      ...validPlatform,
      state: { backend: "remote", path: "./state" },
    });
    expect(r.valid).toBe(false);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// REGION
// ════════════════════════════════════════════════════════════════════════════

describe("RegionSchema", () => {
  test("valid region passes", () => {
    const r = validateRegionSchema({ name: "eu", dns_zone: "eu.example.com", hub: "hub-eu", compliance: [] }, "region.yaml");
    expect(r.errors.length).toBe(0);
  });

  test("invalid hub prefix fails", () => {
    const r = validateRegionSchema({ name: "eu", dns_zone: "eu.example.com", hub: "zone-eu" }, "region.yaml");
    expect(r.valid).toBe(false);
  });

  test("missing dns_zone fails", () => {
    const r = validateRegionSchema({ name: "eu" }, "region.yaml");
    expect(r.valid).toBe(false);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// NODES
// ════════════════════════════════════════════════════════════════════════════

describe("NodesSchema", () => {
  const validNodes = {
    nodes: [
      { name: "pve-01", public_ip: "10.1.10.10", role: "primary", bootstrap: { user: "root", port: 22, password: { type: "env", var_name: "PVE_01_PW" } } },
      { name: "pve-02", public_ip: "10.1.10.11", role: "secondary", bootstrap: { user: "root", port: 22, password: { type: "env", var_name: "PVE_02_PW" } } },
    ],
  };

  test("valid nodes pass", () => {
    const r = validateNodesSchema(validNodes, "nodes.yaml");
    expect(r.errors.length).toBe(0);
  });

  test("empty nodes fails", () => {
    const r = validateNodesSchema({ nodes: [] }, "nodes.yaml");
    expect(r.valid).toBe(false);
  });

  test("duplicate node names fail", () => {
    const r = validateNodesSchema({
      nodes: [
        { name: "pve-01", public_ip: "10.1.10.10", role: "primary" },
        { name: "pve-01", public_ip: "10.1.10.11", role: "secondary" },
      ],
    }, "nodes.yaml");
    expect(r.valid).toBe(false);
  });

  test("two primaries fail", () => {
    const r = validateNodesSchema({
      nodes: [
        { name: "pve-01", public_ip: "10.1.10.10", role: "primary" },
        { name: "pve-02", public_ip: "10.1.10.11", role: "primary" },
      ],
    }, "nodes.yaml");
    expect(r.valid).toBe(false);
  });

  test("invalid IP fails", () => {
    const r = validateNodesSchema({
      nodes: [{ name: "pve-01", public_ip: "999.999.999.999", role: "primary" }],
    }, "nodes.yaml");
    expect(r.valid).toBe(false);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// SSH
// ════════════════════════════════════════════════════════════════════════════

describe("SshSchema", () => {
  const validSsh = {
    rotation_policy: { max_age_days: 90, warning_days: 14 },
    knockd: { enabled: true, sequence: [7000, 8500, 9000], seq_timeout: 5, port_timeout: 30 },
    users: [
      { user: "admin", groups: ["sudo"], shell: "/bin/bash", public_key: { type: "file", path: ".ssh/admin.pub" }, private_key: { type: "file", path: ".ssh/admin" } },
      { user: "backup", groups: ["sudo"], shell: "/bin/bash", public_key: { type: "file", path: ".ssh/backup.pub" }, private_key: { type: "file", path: ".ssh/backup" } },
    ],
  };

  test("valid ssh passes", () => {
    const r = validateSshSchema(validSsh, "ssh.yaml");
    expect(r.errors.length).toBe(0);
  });

  test("only 1 user fails", () => {
    const r = validateSshSchema({ ...validSsh, users: [validSsh.users[0]] }, "ssh.yaml");
    expect(r.valid).toBe(false);
  });

  test("warning_days >= max_age_days fails", () => {
    const r = validateSshSchema({ ...validSsh, rotation_policy: { max_age_days: 30, warning_days: 30 } }, "ssh.yaml");
    expect(r.valid).toBe(false);
  });

  test("knockd enabled without sequence fails", () => {
    const r = validateSshSchema({ ...validSsh, knockd: { enabled: true } }, "ssh.yaml");
    expect(r.valid).toBe(false);
  });

  test("knockd with default sequence fails validation", () => {
    const dc = { name: "zone-paris", type: "zone" as const, region: "eu", dirPath: "/tmp" };
    const parsed = {
      ...validSsh,
      knockd: { enabled: true, sequence: [7000, 8500, 9000, 12000], seq_timeout: 5, port_timeout: 30 },
    };
    const r = validateSsh(parsed, dc, "/tmp");
    expect(r.valid).toBe(false);
    expect(r.errors.some(e => e.message.includes("default sequence"))).toBe(true);
  });

  test("knockd with custom sequence passes validation", () => {
    const dc = { name: "zone-paris", type: "zone" as const, region: "eu", dirPath: "/tmp" };
    const parsed = {
      ...validSsh,
      knockd: { enabled: true, sequence: [12345, 54321, 33333], seq_timeout: 5, port_timeout: 30 },
    };
    const r = validateSsh(parsed, dc, "/tmp");
    // Should not have knockd.sequence errors (may have key file warnings)
    expect(r.errors.filter(e => e.field === "knockd.sequence").length).toBe(0);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// WORKLOAD
// ════════════════════════════════════════════════════════════════════════════

describe("WorkloadFileSchema", () => {
  test("valid workload passes", () => {
    const r = validateWorkloadSchema({
      services: [{
        role: "database",
        scope: "global",
        implementation: "postgresql",
        version: "16",
        instances: [{ name: "db-01", vm_id: 1200, flavor: "large", image: "debian-12", host: "pve-01" }],
      }],
    }, "database.yaml");
    expect(r.errors.length).toBe(0);
  });

  test("unknown role fails", () => {
    const r = validateWorkloadSchema({
      services: [{
        role: "unknown-thing",
        scope: "global",
        implementation: "foo",
        version: "1",
        instances: [{ name: "x", vm_id: 1, flavor: "s", image: "d", host: "h" }],
      }],
    }, "test.yaml");
    expect(r.valid).toBe(false);
  });

  test("wrong implementation for role fails", () => {
    const r = validateWorkloadSchema({
      services: [{
        role: "database",
        scope: "global",
        implementation: "nginx",
        version: "1",
        instances: [{ name: "x", vm_id: 1, flavor: "s", image: "d", host: "h" }],
      }],
    }, "test.yaml");
    expect(r.valid).toBe(false);
  });

  test("regional without region fails", () => {
    const r = validateWorkloadSchema({
      services: [{
        role: "metrics",
        scope: "regional",
        implementation: "prometheus",
        version: "2.53",
        instances: [{ name: "x", vm_id: 100000, flavor: "s", image: "d", host: "h" }],
      }],
    }, "test.yaml");
    expect(r.valid).toBe(false);
  });

  test("null overwrite_config passes", () => {
    const r = validateWorkloadSchema({
      services: [{
        role: "database",
        scope: "global",
        implementation: "postgresql",
        version: "16",
        instances: [{ name: "db-01", vm_id: 1200, flavor: "large", image: "debian-12", host: "pve-01" }],
        overwrite_config: null,
      }],
    }, "database.yaml");
    expect(r.errors.length).toBe(0);
  });
});
