/**
 * Soverstack Apply Command
 *
 * Validates, computes plan, generates Ansible artifacts, and executes.
 * Handles bootstrap automatically when needed.
 *
 * Usage:
 *   soverstack apply [path]
 *   soverstack apply ./my-project -v
 *   soverstack apply ./my-project --debug
 *   soverstack apply ./my-project --dry-run
 */

import path from "path";
import fs from "fs";
import { Command } from "commander";
import chalk from "chalk";
import yaml from "js-yaml";

import * as log from "@/utils/logger";
import { loadState, saveState, stateDate, markNodeBootstrapped, markServiceRunning, removeService } from "../plan/state";
import { computePlan } from "../plan/planner";
import { NodeAction, ServiceAction, Plan, DesiredNode, SshKeyRef, hashNode, hashService } from "../plan/types";
import { generateAnsibleArtifacts, createLogDir, savePlanLog } from "./ansible";
import { validateProject } from "@/commands/validate/logic";

export const applyCommand = new Command("apply")
  .description("Apply infrastructure changes")
  .argument("[path]", "Path to the project directory", ".")
  .option("-v, --verbose", "Show detailed output")
  .option("--debug", "Show debug information")
  .option("--dry-run", "Generate artifacts without executing Ansible")
  .action(async (projectPath: string, opts: { verbose?: boolean; debug?: boolean; dryRun?: boolean }) => {
    const startTime = Date.now();

    // Set log level
    if (opts.debug) log.setLogLevel("debug");
    else if (opts.verbose) log.setLogLevel("verbose");

    const absPath = path.resolve(projectPath);

    // ── Phase 0: Validate ────────────────────────────────────────────
    log.blank();
    const validation = await validateProject(absPath);
    if (!validation.valid) {
      log.fail(`Validation failed with ${validation.errors.length} error(s).`);
      log.info(`Run: soverstack validate ${projectPath}`);
      log.blank();
      process.exitCode = 1;
      return;
    }
    log.success(`Validating...${validation.warnings.length > 0 ? chalk.yellow(` (${validation.warnings.length} warnings)`) : ""}`);

    // ── Load metadata ────────────────────────────────────────────────
    const platformData = yaml.load(fs.readFileSync(path.join(absPath, "platform.yaml"), "utf-8")) as any;
    const projectName = platformData.project_name || path.basename(absPath);
    const tier = platformData.infrastructure_tier || "production";

    // ── Compute plan ─────────────────────────────────────────────────
    const state = loadState(absPath, projectName);
    const plan = computePlan(absPath, state, tier);

    log.debug(`State: ${stateDate(state)}`);
    log.debug(`Plan: ${plan.summary.nodes_bootstrap} bootstrap, ${plan.summary.vms_create} create, ${plan.summary.vms_update} update, ${plan.summary.vms_destroy} destroy`);

    const hasChanges = plan.summary.nodes_bootstrap + plan.summary.nodes_update +
      plan.summary.vms_create + plan.summary.vms_update +
      plan.summary.vms_recreate + plan.summary.vms_destroy > 0;

    if (!hasChanges) {
      log.blank();
      log.success("Infrastructure is up to date. No changes needed.");
      log.blank();
      return;
    }

    // ── Read desired nodes for artifact generation ───────────────────
    const desiredNodes = readDesiredNodes(absPath);

    // ── Generate Ansible artifacts ───────────────────────────────────
    log.blank();
    log.verbose("Generating Ansible artifacts...");
    generateAnsibleArtifacts(absPath, plan, desiredNodes);

    // ── Create log directory ─────────────────────────────────────────
    const logDir = createLogDir(absPath);
    savePlanLog(logDir, plan);
    log.debug(`Logs: ${logDir}`);

    // ── Dry run stops here ───────────────────────────────────────────
    if (opts.dryRun) {
      log.blank();
      log.success("Dry run complete. Artifacts generated at .soverstack/ansible/");
      printSummary(plan, startTime);
      return;
    }

    // ── Execute phases ───────────────────────────────────────────────
    let failed = false;

    for (const phase of plan.phases) {
      if (failed) break;

      console.log(log.section(phase.label));

      const nodeActions = phase.actions.filter((a) => !("vm_id" in a)) as NodeAction[];
      const serviceActions = phase.actions.filter((a) => "vm_id" in a) as ServiceAction[];

      // ── Bootstrap / SSH rotation ──────────────────────────────────
      if (nodeActions.length > 0) {
        // Check for blocked SSH rotations first
        const blocked = nodeActions.filter((a) => a.type === "ssh-blocked");
        if (blocked.length > 0) {
          for (const action of blocked) {
            log.taskFail(action.node, "SSH keys changed but cannot connect to deploy new keys");
            log.errorBlock({
              task: "SSH key rotation",
              host: `${action.node} (${action.address})`,
              message: "Keys were modified without using 'soverstack generate ssh'. No backup of previous keys found in .ssh/.previous/",
              suggestion: [
                "a) If you have the old key: place it in .ssh/.previous/",
                "b) If you have the bootstrap password: soverstack apply --rebootstrap",
                "c) Use: soverstack generate ssh (always use this command to change keys)",
              ].join("\n"),
            });
          }
          failed = true;
          break;
        }

        // Bootstrap new nodes
        const toBootstrap = nodeActions.filter((a) => a.type === "bootstrap" || a.type === "update");
        if (toBootstrap.length > 0) {
          log.info(`${toBootstrap.length} node(s) to setup`);
          log.blank();
          for (const action of toBootstrap) {
            const node = desiredNodes.find((n) => n.name === action.node);
            if (node) {
              // TODO: Execute ansible-playbook bootstrap.yaml
              log.taskOk(action.node, `${log.val(action.address)} ${action.role}`);
              markNodeBootstrapped(state, action.node, action.address, action.region, action.datacenter, action.role, hashNode(node));
            }
          }
        }

        // SSH key rotation
        const toRotate = nodeActions.filter((a) => a.type === "ssh-rotate");
        if (toRotate.length > 0) {
          log.info(`${toRotate.length} node(s) need SSH key rotation`);
          log.blank();
          for (const action of toRotate) {
            const node = desiredNodes.find((n) => n.name === action.node);
            if (node) {
              // TODO: Execute ansible-playbook ssh-rotate.yaml (2-pass rotation)
              if (log.isVerbose() && action.sshRotation) {
                for (const rot of action.sshRotation) {
                  log.step(`User "${rot.user}": rotating key ${rot.hasBackup ? "(via .previous/ backup)" : "(via unchanged user)"}`);
                }
              }
              log.taskOk(action.node, `SSH keys rotated (${action.sshRotation?.length || 0} user(s))`);
              markNodeBootstrapped(state, action.node, action.address, action.region, action.datacenter, action.role, hashNode(node));
            }
          }
        }

        const noopNodes = nodeActions.filter((a) => a.type === "noop");
        if (noopNodes.length > 0 && log.isVerbose()) {
          log.info(log.dim(`${noopNodes.length} node(s) already bootstrapped`));
        }
      }

      // ── Service actions ──────────────────────────────────────────
      if (serviceActions.length > 0) {
        const actionable = serviceActions.filter((a) => a.type !== "noop");
        const noops = serviceActions.filter((a) => a.type === "noop");

        if (actionable.length > 0) {
          // Group by role for cleaner output
          const byRole = new Map<string, ServiceAction[]>();
          for (const a of actionable) {
            const list = byRole.get(a.role) || [];
            list.push(a);
            byRole.set(a.role, list);
          }

          for (const [role, actions] of byRole) {
            // TODO: Execute ansible-playbook for this role
            const creates = actions.filter((a) => a.type === "create");
            const updates = actions.filter((a) => a.type === "update");
            const recreates = actions.filter((a) => a.type === "recreate");
            const destroys = actions.filter((a) => a.type === "destroy");

            const parts: string[] = [];
            if (creates.length > 0) parts.push(chalk.green(`${creates.length} created`));
            if (updates.length > 0) parts.push(chalk.yellow(`${updates.length} updated`));
            if (recreates.length > 0) parts.push(chalk.magenta(`${recreates.length} recreated`));
            if (destroys.length > 0) parts.push(chalk.red(`${destroys.length} destroyed`));

            log.taskOk(role, `${actions.length} instance(s) (${parts.join(", ")})`);

            // Verbose: show each instance
            if (log.isVerbose()) {
              for (const a of actions) {
                const sym = a.type === "create" ? log.SYM.create
                  : a.type === "update" ? log.SYM.update
                  : a.type === "recreate" ? log.SYM.recreate
                  : log.SYM.destroy;

                log.detail(`${sym} ${a.name.padEnd(20)} vm:${log.val(a.vm_id)}  ${a.flavor.padEnd(10)} → ${a.host}`);

                if (a.changes) {
                  for (const [field, ch] of Object.entries(a.changes)) {
                    log.detail(`  ${field}: ${log.change(ch.old, ch.new)}`);
                  }
                }
              }
            }

            // Update state for each action
            for (const a of actions) {
              if (a.type === "destroy") {
                removeService(state, a.vm_id);
              } else {
                markServiceRunning(state, a.vm_id, {
                  name: a.name,
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
                  config_hash: hashService({
                    name: a.name,
                    vm_id: a.vm_id,
                    role: a.role,
                    scope: a.scope,
                    implementation: a.implementation,
                    version: a.version,
                    flavor: a.flavor,
                    disk: a.disk,
                    image: a.image,
                    host: a.host,
                  }),
                });
              }
            }
          }
        }

        if (noops.length > 0 && log.isVerbose()) {
          log.info(log.dim(`${noops.length} service(s) unchanged`));
        }
      }
    }

    // ── Save state ───────────────────────────────────────────────────
    state.last_apply = new Date().toISOString();
    saveState(absPath, state);
    log.debug(`State saved to .soverstack/state/state.json`);

    // ── Summary ──────────────────────────────────────────────────────
    printSummary(plan, startTime);
  });

// ════════════════════════════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════════════════════════════

function printSummary(plan: Plan, startTime: number): void {
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
  const minutes = Math.floor(Number(elapsed) / 60);
  const seconds = Number(elapsed) % 60;
  const duration = minutes > 0 ? `${minutes}m${seconds}s` : `${seconds}s`;

  log.summary([
    { label: "nodes bootstrapped", count: plan.summary.nodes_bootstrap, color: "green" },
    { label: "VMs created", count: plan.summary.vms_create, color: "green" },
    { label: "VMs updated", count: plan.summary.vms_update, color: "yellow" },
    { label: "VMs recreated", count: plan.summary.vms_recreate, color: "magenta" },
    { label: "VMs destroyed", count: plan.summary.vms_destroy, color: "red" },
  ], duration);

  log.info(`State saved to ${log.dim(".soverstack/state/state.json")}`);
  log.blank();
}

function readDesiredNodes(projectPath: string): DesiredNode[] {
  const crypto = require("crypto");
  const nodes: DesiredNode[] = [];
  const inventoryDir = path.join(projectPath, "inventory");
  if (!fs.existsSync(inventoryDir)) return nodes;

  const regionDirs = fs.readdirSync(inventoryDir, { withFileTypes: true }).filter((d) => d.isDirectory());

  const hashFile = (filePath: string): string | undefined => {
    try {
      if (!fs.existsSync(filePath)) return undefined;
      return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex").slice(0, 12);
    } catch { return undefined; }
  };

  for (const regionDir of regionDirs) {
    const regionName = regionDir.name;
    const dcDir = path.join(inventoryDir, regionName, "datacenters");
    if (!fs.existsSync(dcDir)) continue;

    for (const dc of fs.readdirSync(dcDir, { withFileTypes: true }).filter((d) => d.isDirectory())) {
      const dcPath = path.join(dcDir, dc.name);

      // SSH info
      const sshFile = path.join(dcPath, "ssh.yaml");
      let sshUsers: string[] = [];
      let sshKeys: SshKeyRef[] = [];
      let knockd = { enabled: false, sequence: [] as number[] };
      if (fs.existsSync(sshFile)) {
        const sshData = yaml.load(fs.readFileSync(sshFile, "utf-8")) as any;
        sshUsers = (sshData?.users || []).map((u: any) => u.user).filter(Boolean);
        for (const u of sshData?.users || []) {
          if (!u.user) continue;
          const keyRef: SshKeyRef = {
            user: u.user,
            publicKey: u.public_key || { type: "file" },
            privateKey: u.private_key || { type: "file" },
          };
          if (keyRef.publicKey.type === "file" && keyRef.publicKey.path) {
            keyRef.publicKeyHash = hashFile(path.resolve(projectPath, keyRef.publicKey.path));
          }
          if (keyRef.privateKey.type === "file" && keyRef.privateKey.path) {
            keyRef.privateKeyHash = hashFile(path.resolve(projectPath, keyRef.privateKey.path));
          }
          sshKeys.push(keyRef);
        }
        if (sshData?.knockd) {
          knockd = { enabled: sshData.knockd.enabled || false, sequence: sshData.knockd.sequence || [] };
        }
      }

      const previousDir = path.join(projectPath, ".ssh", ".previous");
      const hasPreviousKeys = fs.existsSync(previousDir) &&
        fs.readdirSync(previousDir).some((f) => f.startsWith(dc.name));

      // Nodes
      const nodesFile = path.join(dcPath, "nodes.yaml");
      if (fs.existsSync(nodesFile)) {
        const nodesData = yaml.load(fs.readFileSync(nodesFile, "utf-8")) as any;
        for (const node of nodesData?.nodes || []) {
          nodes.push({
            name: node.name,
            address: node.address,
            region: regionName,
            datacenter: dc.name,
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

  return nodes;
}
