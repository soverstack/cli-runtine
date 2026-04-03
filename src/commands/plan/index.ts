/**
 * Soverstack Plan Command
 *
 * Compares desired state (YAML) with current state (state.json)
 * and shows what actions would be taken by apply.
 *
 * Usage:
 *   soverstack plan [path]
 *   soverstack plan ./my-project -v
 *   soverstack plan ./my-project --debug
 */

import path from "path";
import { Command } from "commander";
import chalk from "chalk";

import * as log from "@/utils/logger";
import { loadState, stateDate } from "./state";
import { computePlan } from "./planner";
import { NodeAction, ServiceAction } from "./types";
import { validateProject } from "@/commands/validate/logic";

export const planCommand = new Command("plan")
  .description("Show execution plan (what apply would do)")
  .argument("[path]", "Path to the project directory", ".")
  .option("-v, --verbose", "Show detailed output")
  .option("--debug", "Show debug information")
  .action(async (projectPath: string, opts: { verbose?: boolean; debug?: boolean }) => {
    // Set log level
    if (opts.debug) log.setLogLevel("debug");
    else if (opts.verbose) log.setLogLevel("verbose");

    const absPath = path.resolve(projectPath);

    // ── Validate first ───────────────────────────────────────────────
    const validation = await validateProject(absPath);
    if (!validation.valid) {
      log.blank();
      log.fail(`Validation failed with ${validation.errors.length} error(s). Fix errors before planning.`);
      log.info(`Run: soverstack validate ${projectPath}`);
      log.blank();
      process.exitCode = 1;
      return;
    }

    // ── Load platform for metadata ───────────────────────────────────
    const yaml = require("js-yaml");
    const fs = require("fs");
    const platformData = yaml.load(fs.readFileSync(path.join(absPath, "platform.yaml"), "utf-8")) as any;
    const projectName = platformData.project_name || path.basename(absPath);
    const tier = platformData.infrastructure_tier || "production";

    // ── Load state and compute plan ──────────────────────────────────
    const state = loadState(absPath, projectName);
    const plan = computePlan(absPath, state, tier);

    log.banner("PLAN", projectName, tier, stateDate(state));

    if (validation.warnings.length > 0) {
      log.info(`Validation: ${chalk.green("passed")} ${chalk.yellow(`(${validation.warnings.length} warnings)`)}`);
      log.blank();
    }

    // ── Print phases ─────────────────────────────────────────────────
    for (const phase of plan.phases) {
      console.log(log.section(phase.label));

      for (const action of phase.actions) {
        if ("vm_id" in action) {
          printServiceAction(action as ServiceAction);
        } else {
          printNodeAction(action as NodeAction);
        }
      }
    }

    if (plan.phases.length === 0) {
      log.info(log.dim("No changes detected."));
    }

    // ── Summary ──────────────────────────────────────────────────────
    log.summary([
      { label: "nodes to bootstrap", count: plan.summary.nodes_bootstrap, color: "green" },
      { label: "nodes to update", count: plan.summary.nodes_update, color: "yellow" },
      { label: "VMs to create", count: plan.summary.vms_create, color: "green" },
      { label: "VMs to update", count: plan.summary.vms_update, color: "yellow" },
      { label: "VMs to recreate", count: plan.summary.vms_recreate, color: "magenta" },
      { label: "VMs to destroy", count: plan.summary.vms_destroy, color: "red" },
    ]);

    const hasChanges = plan.summary.nodes_bootstrap + plan.summary.nodes_update +
      plan.summary.vms_create + plan.summary.vms_update +
      plan.summary.vms_recreate + plan.summary.vms_destroy > 0;

    if (hasChanges) {
      log.info(`Run ${chalk.cyan("soverstack apply")} to execute.`);
      log.blank();
    }
  });

// ════════════════════════════════════════════════════════════════════════════
// PRINTERS
// ════════════════════════════════════════════════════════════════════════════

function printNodeAction(action: NodeAction): void {
  const sym = action.type === "bootstrap" ? log.SYM.create
    : action.type === "update" ? log.SYM.update
    : action.type === "ssh-rotate" ? log.SYM.update
    : action.type === "ssh-blocked" ? log.SYM.fail
    : action.type === "orphan" ? log.SYM.warn
    : log.SYM.noop;

  const status = action.type === "bootstrap" ? "bootstrap required"
    : action.type === "update" ? "config changed"
    : action.type === "ssh-rotate" ? chalk.yellow("SSH key rotation")
    : action.type === "ssh-blocked" ? chalk.red("SSH keys changed — cannot connect (no .ssh/.previous/ found)")
    : action.type === "orphan" ? chalk.yellow("orphaned (in state but not in inventory)")
    : log.dim("bootstrapped");

  console.log(`    ${sym} ${chalk.white(action.node.padEnd(24))} ${log.val(action.public_ip.padEnd(16))} ${action.role.padEnd(12)} ${status}`);

  if (action.changes && log.isVerbose()) {
    for (const [field, ch] of Object.entries(action.changes)) {
      log.detail(`${field}: ${log.change(ch.old, ch.new)}`);
    }
  }

  if (action.sshRotation && log.isVerbose()) {
    for (const rot of action.sshRotation) {
      const method = rot.hasBackup ? "via .ssh/.previous/ backup" : "via unchanged user";
      log.detail(`User "${rot.user}": key changed (${method})`);
    }
  }

  if (action.type === "ssh-blocked") {
    log.detail(chalk.red('Fix: run "soverstack generate ssh" to regenerate keys safely'));
  }
}

function printServiceAction(action: ServiceAction): void {
  if (action.type === "noop") {
    log.planLine("noop", action.name, action.vm_id, "no changes");
    return;
  }

  const details = action.type === "destroy"
    ? chalk.red("destroy")
    : `${action.flavor.padEnd(12)} ${action.implementation} ${action.version}  → ${action.host}`;

  log.planLine(action.type, action.name, action.vm_id, details);

  if (action.changes && log.isVerbose()) {
    for (const [field, ch] of Object.entries(action.changes)) {
      log.detail(`${field}: ${log.change(ch.old, ch.new)}`);
    }
  }
}
