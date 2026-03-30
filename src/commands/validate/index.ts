/**
 * Soverstack Validate Command
 *
 * Validates the project structure (inventory/ + workloads/).
 *
 * Usage:
 *   soverstack validate [path]
 *   soverstack validate [path] -v       (show field paths)
 */

import { Command } from "commander";
import chalk from "chalk";

import { validateProject } from "./logic";
import { ValidationIssue } from "./types";

export const validateCommand = new Command("validate")
  .description("Validate a Soverstack project")
  .argument("[path]", "Path to the project directory", ".")
  .option("-v, --verbose", "Show technical field paths")
  .action(async (projectPath: string, opts: { verbose?: boolean }) => {
    try {
      console.log("");
      console.log(chalk.cyan.bold("  SOVERSTACK VALIDATE"));
      console.log(chalk.gray("  Checking project structure and configuration...\n"));

      const result = await validateProject(projectPath);

      if (result.errors.length > 0) {
        console.log(chalk.red.bold(`  ✗ ${result.errors.length} error(s)\n`));
        printIssues(result.errors, "red", opts.verbose);
      }

      if (result.warnings.length > 0) {
        console.log(chalk.yellow.bold(`  ⚠ ${result.warnings.length} warning(s)\n`));
        printIssues(result.warnings, "yellow", opts.verbose);
      }

      if (result.valid) {
        console.log(chalk.green.bold("  ✓ Validation passed"));
        if (result.warnings.length > 0) {
          console.log(chalk.yellow(`    (with ${result.warnings.length} warning(s))`));
        }
        console.log("");
      } else {
        console.log(
          chalk.red.bold(`\n  ✗ Validation failed with ${result.errors.length} error(s)`),
        );
        console.log("");
        process.exitCode = 1;
      }
    } catch (error) {
      console.log(chalk.red("\n  Validation failed:"));
      console.log(chalk.red("  " + (error as Error).message));
      process.exitCode = 1;
    }
  });

function printIssues(issues: ValidationIssue[], color: "red" | "yellow", verbose?: boolean): void {
  const grouped = new Map<string, ValidationIssue[]>();
  for (const issue of issues) {
    const list = grouped.get(issue.file) || [];
    list.push(issue);
    grouped.set(issue.file, list);
  }

  for (const [file, fileIssues] of grouped) {
    console.log(chalk.gray(`  ${file}`));
    for (const issue of fileIssues) {
      const colorFn = color === "red" ? chalk.red : chalk.yellow;
      console.log(`    ${colorFn("→")} ${issue.message}`);
      if (issue.hint) {
        console.log(chalk.dim(`      ${issue.hint}`));
      }
      if (verbose && issue.field) {
        console.log(chalk.dim(`      field: ${issue.field}`));
      }
    }
    console.log("");
  }
}
