import chalk from "chalk";
import { ValidationResult } from "./types";

/**
 * Formats validation results for console output
 */
export function formatValidationResult(result: ValidationResult): string {
  const lines: string[] = [];

  // Header
  if (result.valid) {
    lines.push(chalk.green("\n✅ Validation successful!\n"));
  } else {
    lines.push(chalk.red("\n❌ Validation failed!\n"));
  }

  // Errors
  if (result.errors.length > 0) {
    lines.push(chalk.red.bold(`\n🚨 ${result.errors.length} Error(s):\n`));

    result.errors.forEach((error, index) => {
      const icon = error.severity === "critical" ? "🔴" : "❗";
      lines.push(chalk.red(`${icon} [${error.layer}] ${error.field}`));
      lines.push(chalk.gray(`   ${error.message}`));

      if (error.suggestion) {
        lines.push(chalk.yellow(`   💡 ${error.suggestion}`));
      }

      if (index < result.errors.length - 1) {
        lines.push(""); // Empty line between errors
      }
    });
  }

  // Warnings
  if (result.warnings.length > 0) {
    lines.push(chalk.yellow.bold(`\n⚠️  ${result.warnings.length} Warning(s):\n`));

    result.warnings.forEach((warning, index) => {
      lines.push(chalk.yellow(`⚠️  [${warning.layer}] ${warning.field}`));
      lines.push(chalk.gray(`   ${warning.message}`));

      if (warning.suggestion) {
        lines.push(chalk.cyan(`   💡 ${warning.suggestion}`));
      }

      if (index < result.warnings.length - 1) {
        lines.push(""); // Empty line between warnings
      }
    });
  }

  // Summary
  if (result.valid && result.warnings.length === 0) {
    lines.push(chalk.green("\n✨ Configuration is valid and ready to use!\n"));
  } else if (result.valid && result.warnings.length > 0) {
    lines.push(
      chalk.yellow(
        `\n✅ Configuration is valid but has ${result.warnings.length} warning(s)\n`
      )
    );
  } else {
    lines.push(
      chalk.red(`\n❌ Fix ${result.errors.length} error(s) before proceeding\n`)
    );
  }

  return lines.join("\n");
}

/**
 * Formats a validation summary for JSON output
 */
export function formatValidationJson(result: ValidationResult): string {
  return JSON.stringify(
    {
      valid: result.valid,
      error_count: result.errors.length,
      warning_count: result.warnings.length,
      errors: result.errors,
      warnings: result.warnings,
    },
    null,
    2
  );
}
