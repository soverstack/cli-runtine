/**
 * Tests for init generators — verify generated files are correct
 */

import fs from "fs";
import path from "path";
import os from "os";
import yaml from "js-yaml";

import { ProjectInitializer } from "../logic";
import { InitOptions } from "../types";

// ════════════════════════════════════════════════════════════════════════════
// SETUP
// ════════════════════════════════════════════════════════════════════════════

let tmpDir: string;
let projectPath: string;

const defaultOptions: InitOptions = {
  projectName: "test-project",
  domain: "test.com",
  regions: [
    { name: "eu", zones: ["paris", "nrb"], hub: "hub-eu" },
    { name: "asia", zones: ["phil"], hub: "hub-eu" },
  ],
  primaryRegion: "eu",
  primaryZone: "paris",
  generateSshKeys: false,
  infrastructureTier: "production",
  complianceLevel: "startup",
  skipHubs: false,
};

beforeAll(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "soverstack-test-"));
  process.chdir(tmpDir);
  const init = new ProjectInitializer(defaultOptions);
  await init.initialize();
  projectPath = path.join(tmpDir, "test-project");
});

afterAll(() => {
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* Windows EBUSY */ }
});

function loadYaml(relativePath: string): any {
  return yaml.load(fs.readFileSync(path.join(projectPath, relativePath), "utf-8"));
}

// ════════════════════════════════════════════════════════════════════════════
// STRUCTURE
// ════════════════════════════════════════════════════════════════════════════

describe("project structure", () => {
  test("root files exist", () => {
    expect(fs.existsSync(path.join(projectPath, "platform.yaml"))).toBe(true);
    expect(fs.existsSync(path.join(projectPath, ".env"))).toBe(true);
    expect(fs.existsSync(path.join(projectPath, ".gitignore"))).toBe(true);
    expect(fs.existsSync(path.join(projectPath, "README.md"))).toBe(true);
  });

  test(".soverstack has correct structure", () => {
    expect(fs.existsSync(path.join(projectPath, ".soverstack/state"))).toBe(true);
    expect(fs.existsSync(path.join(projectPath, ".soverstack/ansible"))).toBe(true);
    expect(fs.existsSync(path.join(projectPath, ".soverstack/logs"))).toBe(true);
    expect(fs.existsSync(path.join(projectPath, ".soverstack/cache"))).toBe(true);
  });

  test("inventory directories exist for each region", () => {
    expect(fs.existsSync(path.join(projectPath, "inventory/eu/region.yaml"))).toBe(true);
    expect(fs.existsSync(path.join(projectPath, "inventory/asia/region.yaml"))).toBe(true);
  });

  test("datacenter directories exist", () => {
    // eu owns its hub
    expect(fs.existsSync(path.join(projectPath, "inventory/eu/datacenters/hub-eu"))).toBe(true);
    expect(fs.existsSync(path.join(projectPath, "inventory/eu/datacenters/zone-paris"))).toBe(true);
    expect(fs.existsSync(path.join(projectPath, "inventory/eu/datacenters/zone-nrb"))).toBe(true);
    // asia uses shared hub — no hub-* folder in asia
    expect(fs.existsSync(path.join(projectPath, "inventory/asia/datacenters/hub-eu"))).toBe(false);
    expect(fs.existsSync(path.join(projectPath, "inventory/asia/datacenters/zone-phil"))).toBe(true);
  });

  test("each datacenter has nodes.yaml, network.yaml, ssh.yaml", () => {
    const dcs = ["eu/datacenters/hub-eu", "eu/datacenters/zone-paris", "eu/datacenters/zone-nrb", "asia/datacenters/zone-phil"];
    for (const dc of dcs) {
      expect(fs.existsSync(path.join(projectPath, "inventory", dc, "nodes.yaml"))).toBe(true);
      expect(fs.existsSync(path.join(projectPath, "inventory", dc, "network.yaml"))).toBe(true);
      expect(fs.existsSync(path.join(projectPath, "inventory", dc, "ssh.yaml"))).toBe(true);
    }
  });

  test("workload files exist", () => {
    // Global
    for (const name of ["database", "dns", "secrets", "identity", "mesh"]) {
      expect(fs.existsSync(path.join(projectPath, `workloads/global/${name}.yaml`))).toBe(true);
    }
    // Regional
    for (const region of ["eu", "asia"]) {
      for (const name of ["monitoring", "bastion", "siem"]) {
        expect(fs.existsSync(path.join(projectPath, `workloads/regional/${region}/${name}.yaml`))).toBe(true);
      }
    }
    // Zonal
    expect(fs.existsSync(path.join(projectPath, "workloads/zonal/eu/zone-paris/firewall.yaml"))).toBe(true);
    expect(fs.existsSync(path.join(projectPath, "workloads/zonal/eu/hub-eu/storage.yaml"))).toBe(true);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// PLATFORM.YAML
// ════════════════════════════════════════════════════════════════════════════

describe("platform.yaml", () => {
  test("has correct project name and domain", () => {
    const p = loadYaml("platform.yaml");
    expect(p.project_name).toBe("test-project");
    expect(p.domain).toBe("test.com");
  });

  test("has correct tier", () => {
    const p = loadYaml("platform.yaml");
    expect(p.infrastructure_tier).toBe("production");
  });

  test("has global_placement pointing to control plane", () => {
    const p = loadYaml("platform.yaml");
    expect(p.defaults.global_placement.datacenter).toBe("zone-paris");
  });

  test("has at least one image with default", () => {
    const p = loadYaml("platform.yaml");
    expect(p.images.length).toBeGreaterThan(0);
    expect(p.images.filter((i: any) => i.default === true).length).toBe(1);
  });

  test("has flavors with numeric values", () => {
    const p = loadYaml("platform.yaml");
    for (const f of p.flavors) {
      expect(typeof f.cpu).toBe("number");
      expect(typeof f.ram).toBe("number");
      expect(typeof f.disk).toBe("number");
    }
  });
});

// ════════════════════════════════════════════════════════════════════════════
// REGION.YAML
// ════════════════════════════════════════════════════════════════════════════

describe("region.yaml", () => {
  test("eu region has hub reference", () => {
    const r = loadYaml("inventory/eu/region.yaml");
    expect(r.name).toBe("eu");
    expect(r.hub).toBe("hub-eu");
  });

  test("asia region references shared hub", () => {
    const r = loadYaml("inventory/asia/region.yaml");
    expect(r.name).toBe("asia");
    expect(r.hub).toBe("hub-eu");
  });

  test("no datacenters array in region.yaml (discovered from filesystem)", () => {
    const r = loadYaml("inventory/eu/region.yaml");
    expect(r.datacenters).toBeUndefined();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// VM IDs — NO COLLISIONS
// ════════════════════════════════════════════════════════════════════════════

describe("VM ID uniqueness", () => {
  test("all vm_ids across the project are unique", () => {
    const allVmIds = new Set<number>();
    const duplicates: number[] = [];

    function scanWorkloads(dir: string) {
      if (!fs.existsSync(dir)) return;
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          scanWorkloads(fullPath);
        } else if (entry.name.endsWith(".yaml")) {
          const data = yaml.load(fs.readFileSync(fullPath, "utf-8")) as any;
          for (const svc of data?.services || []) {
            for (const inst of svc?.instances || []) {
              if (inst.vm_id !== undefined) {
                if (allVmIds.has(inst.vm_id)) {
                  duplicates.push(inst.vm_id);
                }
                allVmIds.add(inst.vm_id);
              }
            }
          }
        }
      }
    }

    scanWorkloads(path.join(projectPath, "workloads"));
    expect(duplicates).toEqual([]);
    expect(allVmIds.size).toBeGreaterThan(0);
  });

  test("global vm_ids are in range 1000-1499", () => {
    const dir = path.join(projectPath, "workloads/global");
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".yaml"));
    for (const file of files) {
      const data = yaml.load(fs.readFileSync(path.join(dir, file), "utf-8")) as any;
      for (const svc of data?.services || []) {
        for (const inst of svc?.instances || []) {
          expect(inst.vm_id).toBeGreaterThanOrEqual(1000);
          expect(inst.vm_id).toBeLessThan(1500);
        }
      }
    }
  });

  test("regional/zonal vm_ids are >= 100000", () => {
    function scan(dir: string) {
      if (!fs.existsSync(dir)) return;
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          scan(fullPath);
        } else if (entry.name.endsWith(".yaml")) {
          const data = yaml.load(fs.readFileSync(fullPath, "utf-8")) as any;
          for (const svc of data?.services || []) {
            for (const inst of svc?.instances || []) {
              expect(inst.vm_id).toBeGreaterThanOrEqual(100000);
            }
          }
        }
      }
    }

    scan(path.join(projectPath, "workloads/regional"));
    scan(path.join(projectPath, "workloads/zonal"));
  });
});

// ════════════════════════════════════════════════════════════════════════════
// SHARED HUB
// ════════════════════════════════════════════════════════════════════════════

describe("shared hub", () => {
  test("hub files only exist in the owning region", () => {
    // eu owns hub-eu
    expect(fs.existsSync(path.join(projectPath, "inventory/eu/datacenters/hub-eu/nodes.yaml"))).toBe(true);
    // asia does NOT have hub-eu duplicated
    expect(fs.existsSync(path.join(projectPath, "inventory/asia/datacenters/hub-eu"))).toBe(false);
  });

  test("hub workloads only exist in the owning region", () => {
    expect(fs.existsSync(path.join(projectPath, "workloads/zonal/eu/hub-eu/storage.yaml"))).toBe(true);
    expect(fs.existsSync(path.join(projectPath, "workloads/zonal/asia/hub-eu"))).toBe(false);
  });
});
