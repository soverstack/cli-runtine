/**
 * Ansible artifact generator
 *
 * Generates hostvars, inventory, and VM definitions
 * that Ansible playbooks will consume.
 */

import fs from "fs";
import path from "path";
import yaml from "js-yaml";

import { DesiredNode, Plan, NodeAction, ServiceAction } from "../plan/types";
import * as log from "@/utils/logger";

const ANSIBLE_DIR = ".soverstack/ansible";

// ════════════════════════════════════════════════════════════════════════════
// MAIN
// ════════════════════════════════════════════════════════════════════════════

export function generateAnsibleArtifacts(projectPath: string, plan: Plan, nodes: DesiredNode[]): void {
  const ansibleDir = path.join(projectPath, ANSIBLE_DIR);

  // Clean previous artifacts
  if (fs.existsSync(ansibleDir)) {
    fs.rmSync(ansibleDir, { recursive: true });
  }

  // Generate bootstrap hostvars if needed
  const bootstrapPhase = plan.phases.find((p) => p.name === "bootstrap");
  if (bootstrapPhase) {
    const bootstrapNodes = bootstrapPhase.actions
      .filter((a) => (a as NodeAction).type === "bootstrap" || (a as NodeAction).type === "update")
      .map((a) => (a as NodeAction).node);

    if (bootstrapNodes.length > 0) {
      generateBootstrapHostvars(projectPath, nodes.filter((n) => bootstrapNodes.includes(n.name)));
      generateInventory(projectPath, nodes);
    }
  }

  // Generate VM definitions for each service phase
  for (const phase of plan.phases) {
    if (phase.name === "bootstrap" || phase.name === "destroy") continue;

    const serviceActions = phase.actions.filter((a) => "vm_id" in a && (a as ServiceAction).type !== "noop") as ServiceAction[];
    if (serviceActions.length > 0) {
      generateVmDefinitions(projectPath, phase.label, serviceActions);
    }
  }

  // Generate destroy definitions
  const destroyPhase = plan.phases.find((p) => p.name === "destroy");
  if (destroyPhase) {
    const destroyActions = destroyPhase.actions as ServiceAction[];
    if (destroyActions.length > 0) {
      generateDestroyDefinitions(projectPath, destroyActions);
    }
  }
}

// ════════════════════════════════════════════════════════════════════════════
// BOOTSTRAP HOSTVARS
// ════════════════════════════════════════════════════════════════════════════

function generateBootstrapHostvars(projectPath: string, nodes: DesiredNode[]): void {
  const hostVarsDir = path.join(projectPath, ANSIBLE_DIR, "host_vars");
  fs.mkdirSync(hostVarsDir, { recursive: true });

  for (const node of nodes) {
    const hostVar: Record<string, unknown> = {
      ansible_host: node.address,
      ansible_user: node.bootstrap.user,
      ansible_port: node.bootstrap.port,
    };

    // Password reference
    if (node.bootstrap.password.type === "env") {
      hostVar.ansible_password = `{{ lookup('env', '${node.bootstrap.password.var_name}') }}`;
    } else if (node.bootstrap.password.type === "vault") {
      hostVar.ansible_password = `{{ lookup('hashi_vault', '${node.bootstrap.password.path}') }}`;
    }

    hostVar.bootstrap = {
      hostname: node.name,
      role: node.role,
      capabilities: node.capabilities,
    };

    hostVar.ssh_users = node.sshUsers.map((user) => ({
      name: user,
    }));

    hostVar.knockd = node.knockd;

    hostVar.security = {
      disable_password_auth: true,
      disable_root_login: true,
    };

    const filePath = path.join(hostVarsDir, `${node.name}.yaml`);
    fs.writeFileSync(filePath, yaml.dump(hostVar, { lineWidth: -1 }));

    log.step(`${filePath.replace(projectPath + path.sep, "")}`);
    log.detail(`host: ${log.val(node.address)}  user: ${node.bootstrap.user}  port: ${node.bootstrap.port}`);
    log.detail(`ssh_users: ${node.sshUsers.join(", ")}`);
    if (node.knockd.enabled) {
      log.detail(`knockd: [${node.knockd.sequence?.join(", ")}]`);
    }
  }
}

// ════════════════════════════════════════════════════════════════════════════
// INVENTORY
// ════════════════════════════════════════════════════════════════════════════

function generateInventory(projectPath: string, nodes: DesiredNode[]): void {
  const inventoryDir = path.join(projectPath, ANSIBLE_DIR, "inventory");
  fs.mkdirSync(inventoryDir, { recursive: true });

  // Group nodes by datacenter
  const groups: Record<string, string[]> = {};
  for (const node of nodes) {
    const groupName = node.datacenter.replace(/-/g, "_");
    if (!groups[groupName]) groups[groupName] = [];
    groups[groupName].push(node.name);
  }

  const inventory: Record<string, unknown> = {
    all: {
      children: Object.fromEntries(
        Object.entries(groups).map(([group, hosts]) => [
          group,
          { hosts: Object.fromEntries(hosts.map((h) => [h, null])) },
        ])
      ),
    },
  };

  const filePath = path.join(inventoryDir, "hosts.yaml");
  fs.writeFileSync(filePath, yaml.dump(inventory, { lineWidth: -1 }));

  log.step(`${filePath.replace(projectPath + path.sep, "")}`);
  for (const [group, hosts] of Object.entries(groups)) {
    log.detail(`group [${group}]: ${hosts.join(", ")}`);
  }
}

// ════════════════════════════════════════════════════════════════════════════
// VM DEFINITIONS
// ════════════════════════════════════════════════════════════════════════════

function generateVmDefinitions(projectPath: string, phaseLabel: string, actions: ServiceAction[]): void {
  const vmsDir = path.join(projectPath, ANSIBLE_DIR, "vms");
  fs.mkdirSync(vmsDir, { recursive: true });

  // Sanitize filename
  const fileName = phaseLabel.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+$/, "") + ".yaml";
  const filePath = path.join(vmsDir, fileName);

  const vms = actions.map((a) => ({
    name: a.name,
    vm_id: a.vm_id,
    action: a.type,
    role: a.role,
    scope: a.scope,
    region: a.region,
    datacenter: a.datacenter,
    implementation: a.implementation,
    version: a.version,
    flavor: a.flavor,
    disk: a.disk,
    image: a.image,
    host: a.host,
    ...(a.changes ? { changes: a.changes } : {}),
  }));

  fs.writeFileSync(filePath, yaml.dump({ vms }, { lineWidth: -1 }));

  log.step(`${filePath.replace(projectPath + path.sep, "")}`);
  for (const vm of vms) {
    const sym = vm.action === "create" ? log.SYM.create
      : vm.action === "update" ? log.SYM.update
      : vm.action === "recreate" ? log.SYM.recreate
      : log.SYM.destroy;
    log.detail(`${sym} ${vm.name.padEnd(20)} vm:${log.val(vm.vm_id)}  ${vm.flavor.padEnd(10)} ${vm.implementation} ${vm.version}  → ${vm.host}`);
  }
}

// ════════════════════════════════════════════════════════════════════════════
// DESTROY DEFINITIONS
// ════════════════════════════════════════════════════════════════════════════

function generateDestroyDefinitions(projectPath: string, actions: ServiceAction[]): void {
  const vmsDir = path.join(projectPath, ANSIBLE_DIR, "vms");
  fs.mkdirSync(vmsDir, { recursive: true });

  const filePath = path.join(vmsDir, "destroy.yaml");

  const vms = actions.map((a) => ({
    name: a.name,
    vm_id: a.vm_id,
    host: a.host,
  }));

  fs.writeFileSync(filePath, yaml.dump({ destroy: vms }, { lineWidth: -1 }));

  log.step(`${filePath.replace(projectPath + path.sep, "")}`);
  for (const vm of vms) {
    log.detail(`${log.SYM.destroy} ${vm.name.padEnd(20)} vm:${log.val(vm.vm_id)}  → ${vm.host}`);
  }
}

// ════════════════════════════════════════════════════════════════════════════
// LOG DIR
// ════════════════════════════════════════════════════════════════════════════

export function createLogDir(projectPath: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const logDir = path.join(projectPath, ".soverstack", "logs", timestamp);
  fs.mkdirSync(logDir, { recursive: true });
  return logDir;
}

export function savePlanLog(logDir: string, plan: Plan): void {
  fs.writeFileSync(path.join(logDir, "plan.json"), JSON.stringify(plan, null, 2) + "\n");
}
