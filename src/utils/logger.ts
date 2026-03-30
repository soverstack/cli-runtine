/**
 * Soverstack Logger
 *
 * Provides structured, colorized output with 3 verbosity levels:
 *   - default:  Progress + results (what the user cares about)
 *   - verbose:  + details (hostvars, tasks, diffs)
 *   - debug:    + technical details (paths, commands, raw output)
 */

import chalk from "chalk";

export type LogLevel = "default" | "verbose" | "debug";

let currentLevel: LogLevel = "default";

export function setLogLevel(level: LogLevel): void {
  currentLevel = level;
}

export function getLogLevel(): LogLevel {
  return currentLevel;
}

export function isVerbose(): boolean {
  return currentLevel === "verbose" || currentLevel === "debug";
}

export function isDebug(): boolean {
  return currentLevel === "debug";
}

// ════════════════════════════════════════════════════════════════════════════
// SYMBOLS
// ════════════════════════════════════════════════════════════════════════════

export const SYM = {
  create: chalk.green("+"),
  update: chalk.yellow("~"),
  recreate: chalk.magenta("!"),
  destroy: chalk.red("-"),
  noop: chalk.gray("="),
  ok: chalk.green("✓"),
  fail: chalk.red("✗"),
  warn: chalk.yellow("⚠"),
  arrow: chalk.cyan("→"),
} as const;

// ════════════════════════════════════════════════════════════════════════════
// FORMATTERS
// ════════════════════════════════════════════════════════════════════════════

/** Highlight a value (vm_id, IP, name) */
export function val(v: string | number): string {
  return chalk.cyan(String(v));
}

/** Dim text for unchanged/secondary info */
export function dim(text: string): string {
  return chalk.gray(text);
}

/** Show a change: old → new */
export function change(oldVal: string | number, newVal: string | number): string {
  return `${chalk.red(String(oldVal))} → ${chalk.green(String(newVal))}`;
}

/** Section separator */
export function section(title: string): string {
  const line = "─".repeat(Math.max(0, 60 - title.length));
  return `\n${chalk.bold(`─── ${title} `)}${chalk.gray(line)}\n`;
}

// ════════════════════════════════════════════════════════════════════════════
// OUTPUT FUNCTIONS
// ════════════════════════════════════════════════════════════════════════════

/** Always shown */
export function info(msg: string): void {
  console.log(`  ${msg}`);
}

/** Always shown */
export function success(msg: string): void {
  console.log(`  ${SYM.ok} ${msg}`);
}

/** Always shown */
export function fail(msg: string): void {
  console.log(`  ${SYM.fail} ${msg}`);
}

/** Always shown */
export function warn(msg: string): void {
  console.log(`  ${SYM.warn} ${msg}`);
}

/** Shown in verbose and debug */
export function verbose(msg: string): void {
  if (isVerbose()) {
    console.log(`  ${msg}`);
  }
}

/** Shown in verbose, with arrow prefix */
export function step(msg: string): void {
  if (isVerbose()) {
    console.log(`    ${SYM.arrow} ${msg}`);
  }
}

/** Shown in verbose, extra indent */
export function detail(msg: string): void {
  if (isVerbose()) {
    console.log(`        ${msg}`);
  }
}

/** Shown only in debug */
export function debug(msg: string): void {
  if (isDebug()) {
    console.log(`  ${chalk.gray(`[DEBUG] ${msg}`)}`);
  }
}

/** Print a blank line */
export function blank(): void {
  console.log("");
}

// ════════════════════════════════════════════════════════════════════════════
// STRUCTURED OUTPUT
// ════════════════════════════════════════════════════════════════════════════

/** Print the main banner */
export function banner(command: string, project: string, tier: string, stateInfo?: string): void {
  blank();
  info(chalk.cyan.bold(`SOVERSTACK ${command.toUpperCase()}`));
  info(`Project: ${val(project)} | Tier: ${val(tier)}${stateInfo ? ` | State: ${stateInfo}` : ""}`);
  blank();
}

/** Print a plan action line */
export function planLine(
  action: "create" | "update" | "recreate" | "destroy" | "noop",
  name: string,
  vmId: number | string,
  details: string
): void {
  const sym = SYM[action];
  const nameStr = chalk.white(name.padEnd(22));
  const vmStr = val(String(vmId).padEnd(8));

  if (action === "noop") {
    console.log(`    ${sym} ${chalk.gray(name.padEnd(22))} ${chalk.gray(String(vmId).padEnd(8))} ${dim(details)}`);
  } else {
    console.log(`    ${sym} ${nameStr} ${vmStr} ${details}`);
  }
}

/** Print a task result in default mode */
export function taskOk(name: string, details: string): void {
  console.log(`    ${SYM.ok} ${chalk.white(name.padEnd(16))} ${details}`);
}

/** Print a task failure in default mode */
export function taskFail(name: string, details: string): void {
  console.log(`    ${SYM.fail} ${chalk.white(name.padEnd(16))} ${chalk.red(details)}`);
}

/** Print an error block with context */
export function errorBlock(opts: {
  task: string;
  host: string;
  message: string;
  context?: string;
  suggestion?: string;
  logFile?: string;
}): void {
  blank();
  console.log(`    ${chalk.red.bold("Error details:")}`);
  console.log(`      Task:    ${opts.task}`);
  console.log(`      Host:    ${opts.host}`);
  console.log(`      Message: ${chalk.red(opts.message)}`);

  if (opts.context) {
    blank();
    console.log(`    ${chalk.yellow("Context:")}`);
    console.log(`      ${opts.context}`);
  }

  if (opts.suggestion) {
    blank();
    console.log(`    ${chalk.green("Suggestion:")}`);
    for (const l of opts.suggestion.split("\n")) {
      console.log(`      ${l}`);
    }
  }

  if (opts.logFile) {
    blank();
    console.log(`    Full log: ${dim(opts.logFile)}`);
  }
  blank();
}

/** Print the summary block */
export function summary(items: { label: string; count: number; color?: string }[], duration?: string): void {
  blank();
  const parts = items
    .filter((i) => i.count > 0)
    .map((i) => {
      const colorFn =
        i.color === "green" ? chalk.green
        : i.color === "yellow" ? chalk.yellow
        : i.color === "red" ? chalk.red
        : i.color === "magenta" ? chalk.magenta
        : chalk.white;
      return `${colorFn(String(i.count))} ${i.label}`;
    });

  if (parts.length > 0) {
    info(parts.join(", "));
  } else {
    info(dim("No changes."));
  }

  if (duration) {
    info(dim(`Completed in ${duration}`));
  }
  blank();
}

// ════════════════════════════════════════════════════════════════════════════
// BACKWARD COMPAT (used by old code)
// ════════════════════════════════════════════════════════════════════════════

export class Logger {
  private _verbose: boolean;
  constructor(v: boolean = false) { this._verbose = v; }
  info(msg: string): void { info(msg); }
  success(msg: string): void { success(msg); }
  warning(msg: string): void { warn(msg); }
  error(msg: string): void { fail(msg); }
  debug(msg: string): void { if (this._verbose) debug(msg); }
  section(title: string): void { console.log(section(title)); }
}

export const logger = new Logger();
