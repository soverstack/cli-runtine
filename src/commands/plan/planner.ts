/**
 * Planner — compute plan by diffing desired state (YAML) vs current state.
 */

import fs from "fs";
import path from "path";
import yaml from "js-yaml";

import crypto from "crypto";

import {
  ProjectState,
  DesiredNode,
  DesiredService,
  SshKeyRef,
  Plan,
  PlanPhase,
  NodeAction,
  ServiceAction,
  GLOBAL_DEPLOY_ORDER,
  hashNode,
  hashService,
  isBreakingChange,
} from "./types";

import * as log from "@/utils/logger";

// ════════════════════════════════════════════════════════════════════════════
// MAIN
// ════════════════════════════════════════════════════════════════════════════

export function computePlan(
  projectPath: string,
  state: ProjectState,
  tier: string
): Plan {
  const desired = readDesiredState(projectPath);
  const plan: Plan = {
    project_name: state.project_name,
    tier,
    state_date: state.last_apply,
    phases: [],
    summary: {
      nodes_bootstrap: 0,
      nodes_update: 0,
      vms_create: 0,
      vms_update: 0,
      vms_recreate: 0,
      vms_destroy: 0,
      vms_noop: 0,
    },
  };

  // ── Phase 1: Bootstrap ──────────────────────────────────────────────
  const bootstrapPhase = planBootstrap(desired.nodes, state);
  if (bootstrapPhase.actions.length > 0) {
    plan.phases.push(bootstrapPhase);
  }
  for (const a of bootstrapPhase.actions) {
    const na = a as NodeAction;
    if (na.type === "bootstrap") plan.summary.nodes_bootstrap++;
    if (na.type === "update") plan.summary.nodes_update++;
  }

  // ── Phase 3: Global ─────────────────────────────────────────────────
  const globalServices = desired.services.filter((s) => s.scope === "global");
  const globalPhase = planServices("GLOBAL", globalServices, state, GLOBAL_DEPLOY_ORDER);
  if (globalPhase.actions.length > 0) {
    plan.phases.push(globalPhase);
  }

  // ── Phase 4: Regional ───────────────────────────────────────────────
  const regions = [...new Set(desired.services.filter((s) => s.scope === "regional").map((s) => s.region!))];
  for (const region of regions.sort()) {
    const regionServices = desired.services.filter((s) => s.scope === "regional" && s.region === region);
    const phase = planServices(`REGIONAL (${region})`, regionServices, state);
    if (phase.actions.length > 0) {
      plan.phases.push(phase);
    }
  }

  // ── Phase 5: Zonal ──────────────────────────────────────────────────
  const dcKeys = [...new Set(desired.services.filter((s) => s.scope === "zonal").map((s) => `${s.region}/${s.datacenter}`))];
  for (const dcKey of dcKeys.sort()) {
    const [region, dc] = dcKey.split("/");
    const dcServices = desired.services.filter((s) => s.scope === "zonal" && s.region === region && s.datacenter === dc);
    const phase = planServices(`ZONAL (${dcKey})`, dcServices, state);
    if (phase.actions.length > 0) {
      plan.phases.push(phase);
    }
  }

  // ── Orphan services (in state but not in desired) ───────────────────
  const desiredVmIds = new Set(desired.services.map((s) => String(s.vm_id)));
  const orphanActions: ServiceAction[] = [];
  for (const [vmId, svc] of Object.entries(state.services)) {
    if (!desiredVmIds.has(vmId)) {
      orphanActions.push({
        type: "destroy",
        vm_id: Number(vmId),
        name: svc.name,
        role: svc.role,
        scope: svc.scope,
        region: svc.region,
        datacenter: svc.datacenter,
        implementation: svc.implementation,
        version: svc.version,
        flavor: svc.flavor,
        disk: svc.disk,
        image: svc.image,
        host: svc.host,
      });
      plan.summary.vms_destroy++;
    }
  }
  if (orphanActions.length > 0) {
    plan.phases.push({
      name: "destroy",
      label: "DESTROY",
      actions: orphanActions,
    });
  }

  // Count summaries from service phases
  for (const phase of plan.phases) {
    for (const action of phase.actions) {
      if ("vm_id" in action) {
        const sa = action as ServiceAction;
        if (sa.type === "create") plan.summary.vms_create++;
        if (sa.type === "update") plan.summary.vms_update++;
        if (sa.type === "recreate") plan.summary.vms_recreate++;
        if (sa.type === "noop") plan.summary.vms_noop++;
        // destroy counted above
      }
    }
  }

  return plan;
}

// ════════════════════════════════════════════════════════════════════════════
// BOOTSTRAP DIFF
// ════════════════════════════════════════════════════════════════════════════

function planBootstrap(desiredNodes: DesiredNode[], state: ProjectState): PlanPhase {
  const actions: NodeAction[] = [];

  for (const node of desiredNodes) {
    const existing = state.nodes[node.name];
    const base = {
      node: node.name,
      address: node.address,
      region: node.region,
      datacenter: node.datacenter,
      role: node.role,
    };

    if (!existing) {
      // New node — needs full bootstrap
      actions.push({ ...base, type: "bootstrap" });
    } else {
      const currentHash = existing.config_hash;
      const desiredHash = hashNode(node);

      if (currentHash === desiredHash) {
        actions.push({ ...base, type: "noop" });
      } else {
        // Something changed — determine what
        const changes: Record<string, { old: string; new: string }> = {};
        if (existing.address !== node.address) {
          changes.address = { old: existing.address, new: node.address };
        }
        if (existing.role !== node.role) {
          changes.role = { old: existing.role, new: node.role };
        }

        // Check if SSH keys changed (key hashes in the node hash)
        const keysChanged = detectSshKeyChanges(node, state);

        if (keysChanged.length > 0) {
          // SSH keys changed — check if we can rotate safely
          const allHaveBackup = keysChanged.every((k) => k.hasBackup);
          const unchangedUser = node.sshKeys.find(
            (k) => !keysChanged.some((c) => c.user === k.user)
          );

          if (allHaveBackup || unchangedUser) {
            // Safe rotation: we have .previous/ or an unchanged user to connect with
            actions.push({
              ...base,
              type: "ssh-rotate",
              changes,
              sshRotation: keysChanged,
            });
          } else {
            // Blocked: keys changed but no way to connect
            actions.push({
              ...base,
              type: "ssh-blocked",
              changes,
              sshRotation: keysChanged,
            });
          }
        } else {
          // Config changed but not SSH keys
          actions.push({ ...base, type: "update", changes });
        }
      }
    }
  }

  // Orphan nodes
  const desiredNodeNames = new Set(desiredNodes.map((n) => n.name));
  for (const [nodeName, nodeState] of Object.entries(state.nodes)) {
    if (!desiredNodeNames.has(nodeName)) {
      actions.push({
        type: "orphan",
        node: nodeName,
        address: nodeState.address,
        region: nodeState.region,
        datacenter: nodeState.datacenter,
        role: nodeState.role,
      });
    }
  }

  return { name: "bootstrap", label: "BOOTSTRAP", actions };
}

/**
 * Detect which SSH users have changed keys compared to what's in state.
 * We compare the key hashes stored in the node's config_hash with the current ones.
 */
function detectSshKeyChanges(
  node: DesiredNode,
  _state: ProjectState
): { user: string; hasBackup: boolean }[] {
  // If node has .previous/, the user used `soverstack generate ssh`
  // If not, they edited keys manually
  const changed: { user: string; hasBackup: boolean }[] = [];

  for (const key of node.sshKeys) {
    // If the key has a hash, it exists on disk
    // The hash is already included in hashNode(), so if the overall hash changed
    // and we get here, at least one key changed. We check each one.
    if (key.publicKeyHash || key.privateKeyHash) {
      // We can't compare with the old hash individually (it's mixed into the node hash).
      // But if we're here, the overall hash changed. Mark all keys as potentially changed.
      // The hasPreviousKeys flag tells us if safe rotation is possible.
      changed.push({
        user: key.user,
        hasBackup: node.hasPreviousKeys,
      });
    }
  }

  return changed;
}

// ════════════════════════════════════════════════════════════════════════════
// SERVICE DIFF
// ════════════════════════════════════════════════════════════════════════════

function planServices(
  label: string,
  desired: DesiredService[],
  state: ProjectState,
  order?: string[]
): PlanPhase {
  // Sort by deploy order if provided
  const sorted = order
    ? desired.sort((a, b) => {
        const ai = order.indexOf(a.role);
        const bi = order.indexOf(b.role);
        return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
      })
    : desired;

  const actions: ServiceAction[] = [];

  for (const svc of sorted) {
    const existing = state.services[String(svc.vm_id)];

    if (!existing) {
      actions.push(serviceToAction("create", svc));
    } else {
      const currentHash = existing.config_hash;
      const desiredHash = hashService(svc);

      if (currentHash === desiredHash) {
        actions.push(serviceToAction("noop", svc));
      } else {
        // Determine what changed
        const changes: Record<string, { old: string | number; new: string | number }> = {};
        if (existing.implementation !== svc.implementation) changes.implementation = { old: existing.implementation, new: svc.implementation };
        if (existing.version !== svc.version) changes.version = { old: existing.version, new: svc.version };
        if (existing.flavor !== svc.flavor) changes.flavor = { old: existing.flavor, new: svc.flavor };
        if (existing.disk !== svc.disk && (existing.disk || svc.disk)) changes.disk = { old: existing.disk || 0, new: svc.disk || 0 };
        if (existing.image !== svc.image) changes.image = { old: existing.image, new: svc.image };
        if (existing.host !== svc.host) changes.host = { old: existing.host, new: svc.host };

        const actionType = isBreakingChange(changes) ? "recreate" : "update";
        const action = serviceToAction(actionType, svc);
        action.changes = changes;
        actions.push(action);
      }
    }
  }

  return { name: label.toLowerCase().replace(/[^a-z0-9]/g, "_"), label, actions };
}

function serviceToAction(type: ServiceAction["type"], svc: DesiredService): ServiceAction {
  return {
    type,
    vm_id: svc.vm_id,
    name: svc.name,
    role: svc.role,
    scope: svc.scope,
    region: svc.region,
    datacenter: svc.datacenter,
    implementation: svc.implementation,
    version: svc.version,
    flavor: svc.flavor,
    disk: svc.disk,
    image: svc.image,
    host: svc.host,
  };
}

// ════════════════════════════════════════════════════════════════════════════
// READ DESIRED STATE FROM YAML
// ════════════════════════════════════════════════════════════════════════════

interface DesiredState {
  nodes: DesiredNode[];
  services: DesiredService[];
}

function readDesiredState(projectPath: string): DesiredState {
  const nodes: DesiredNode[] = [];
  const services: DesiredService[] = [];

  const inventoryDir = path.join(projectPath, "inventory");
  const workloadsDir = path.join(projectPath, "workloads");

  // ── Scan inventory for nodes ────────────────────────────────────────
  if (fs.existsSync(inventoryDir)) {
    const regionDirs = fs.readdirSync(inventoryDir, { withFileTypes: true }).filter((d) => d.isDirectory());

    for (const regionDir of regionDirs) {
      const regionName = regionDir.name;
      const regionPath = path.join(inventoryDir, regionName);

      // Read region.yaml for ssh/knockd info
      const sshByDc = new Map<string, { users: string[]; knockd: { enabled: boolean; sequence?: number[] } }>();

      const dcDir = path.join(regionPath, "datacenters");
      if (!fs.existsSync(dcDir)) continue;

      const dcDirs = fs.readdirSync(dcDir, { withFileTypes: true }).filter((d) => d.isDirectory());

      for (const dc of dcDirs) {
        const dcName = dc.name;
        const dcPath = path.join(dcDir, dcName);

        // Read ssh.yaml
        const sshFile = path.join(dcPath, "ssh.yaml");
        let sshUsers: string[] = [];
        let sshKeys: SshKeyRef[] = [];
        let knockd = { enabled: false, sequence: [] as number[] };
        if (fs.existsSync(sshFile)) {
          const sshData = yaml.load(fs.readFileSync(sshFile, "utf-8")) as any;
          sshUsers = (sshData?.users || []).map((u: any) => u.user).filter(Boolean);

          // Build SSH key refs with content hashes
          for (const u of sshData?.users || []) {
            if (!u.user) continue;
            const keyRef: SshKeyRef = {
              user: u.user,
              publicKey: u.public_key || { type: "file" },
              privateKey: u.private_key || { type: "file" },
            };
            // Hash key file content if type: file
            if (keyRef.publicKey.type === "file" && keyRef.publicKey.path) {
              keyRef.publicKeyHash = hashFileContent(path.resolve(projectPath, keyRef.publicKey.path));
            }
            if (keyRef.privateKey.type === "file" && keyRef.privateKey.path) {
              keyRef.privateKeyHash = hashFileContent(path.resolve(projectPath, keyRef.privateKey.path));
            }
            sshKeys.push(keyRef);
          }

          if (sshData?.knockd) {
            knockd = {
              enabled: sshData.knockd.enabled || false,
              sequence: sshData.knockd.sequence || [],
            };
          }
        }

        // Check if .ssh/.previous/ exists for this DC
        const sshDir = path.join(projectPath, ".ssh");
        const previousDir = path.join(sshDir, ".previous");
        const hasPreviousKeys = fs.existsSync(previousDir) &&
          fs.readdirSync(previousDir).some((f) => f.startsWith(dcName));

        // Read nodes.yaml
        const nodesFile = path.join(dcPath, "nodes.yaml");
        if (fs.existsSync(nodesFile)) {
          const nodesData = yaml.load(fs.readFileSync(nodesFile, "utf-8")) as any;
          for (const node of nodesData?.nodes || []) {
            nodes.push({
              name: node.name,
              address: node.address,
              region: regionName,
              datacenter: dcName,
              role: node.role || "secondary",
              capabilities: node.capabilities || [],
              bootstrap: {
                user: node.bootstrap?.user || "root",
                port: node.bootstrap?.port || 22,
                password: node.bootstrap?.password || { type: "env", var_name: "" },
              },
              sshUsers,
              sshKeys,
              knockd,
              hasPreviousKeys,
            });
          }
        }
      }
    }
  }

  // ── Scan workloads for services ─────────────────────────────────────
  const scanWorkloadDir = (dir: string, scope: string, region?: string, datacenter?: string) => {
    if (!fs.existsSync(dir)) return;
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"));
    for (const file of files) {
      const filePath = path.join(dir, file);
      const data = yaml.load(fs.readFileSync(filePath, "utf-8")) as any;
      for (const svc of data?.services || []) {
        for (const inst of svc?.instances || []) {
          services.push({
            name: inst.name,
            vm_id: inst.vm_id,
            role: svc.role,
            scope,
            region: svc.region || region,
            datacenter: svc.datacenter || datacenter,
            implementation: svc.implementation,
            version: svc.version,
            flavor: inst.flavor,
            disk: inst.disk,
            image: inst.image,
            host: inst.host,
            overwrite_config: svc.overwrite_config,
          });
        }
      }
    }
  };

  // Global
  scanWorkloadDir(path.join(workloadsDir, "global"), "global");

  // Regional
  const regionalDir = path.join(workloadsDir, "regional");
  if (fs.existsSync(regionalDir)) {
    for (const r of fs.readdirSync(regionalDir, { withFileTypes: true }).filter((d) => d.isDirectory())) {
      scanWorkloadDir(path.join(regionalDir, r.name), "regional", r.name);
    }
  }

  // Zonal
  const zonalDir = path.join(workloadsDir, "zonal");
  if (fs.existsSync(zonalDir)) {
    for (const r of fs.readdirSync(zonalDir, { withFileTypes: true }).filter((d) => d.isDirectory())) {
      const regionZonalDir = path.join(zonalDir, r.name);
      for (const dc of fs.readdirSync(regionZonalDir, { withFileTypes: true }).filter((d) => d.isDirectory())) {
        scanWorkloadDir(path.join(regionZonalDir, dc.name), "zonal", r.name, dc.name);
      }
    }
  }

  log.debug(`Desired state: ${nodes.length} nodes, ${services.length} service instances`);
  return { nodes, services };
}

// ════════════════════════════════════════════════════════════════════════════
// FILE HASH
// ════════════════════════════════════════════════════════════════════════════

function hashFileContent(filePath: string): string | undefined {
  try {
    if (!fs.existsSync(filePath)) return undefined;
    const content = fs.readFileSync(filePath);
    return crypto.createHash("sha256").update(content).digest("hex").slice(0, 12);
  } catch {
    return undefined;
  }
}
