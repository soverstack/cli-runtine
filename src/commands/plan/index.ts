import { Command } from "commander";
import chalk from "chalk";
import { LayerType } from "@/types";
import ora from "ora";
import path from "path";
import fs from "fs";
import { validateInfrastructure, ValidateOptions } from "../validate/logic";
import { formatValidationJson, formatValidationResult } from "../validate/utils";
import { loadPlan, InfrastructurePlan } from "../validate/utils/plan-generator";

export const planCommand = new Command("plan")
  .description("Generate infrastructure execution plan")
  .argument("<platform-yaml>", "Path to platform.yaml file")
  .option(
    "--layer <layer>",
    "Plan only a specific layer (datacenter, compute, cluster, features, firewall, bastion)"
  )
  .option("-v, --verbose", "Show detailed validation output")
  .option("--json", "Output results in JSON format")
  .option("--plan-output <path>", "Path to save execution plan (default: .soverstack/plan.yaml)")
  .option("--show-resources", "Show detailed resource list in plan summary")
  .option("--show-execution-order", "Show execution order of resources")
  .action(
    async (
      platformYaml: string,
      options: {
        layer?: LayerType;
        json?: boolean;
        verbose?: boolean;
        planOutput?: string;
        showResources?: boolean;
        showExecutionOrder?: boolean;
      }
    ) => {
      try {
        console.log(chalk.blue("\n📋 Soverstack Plan\n"));

        // Verify platform.yaml exists
        const platformPath = path.resolve(platformYaml);
        if (!fs.existsSync(platformPath)) {
          console.log(chalk.red(`❌ File not found: ${platformYaml}\n`));
          process.exit(1);
        }

        const platformDir = path.dirname(platformPath);
        const soverstackDir = path.join(platformDir, ".soverstack");
        const defaultPlanPath = path.join(soverstackDir, "plan.yaml");
        const planOutputPath = options.planOutput ? path.resolve(options.planOutput) : defaultPlanPath;

        // Step 1: Validate infrastructure
        const spinner = ora("Validating infrastructure configuration...").start();

        const validateOptions: ValidateOptions = {
          platformYamlPath: platformYaml,
          layer: options.layer,
          verbose: options.verbose,
          generatePlan: true,
          planOutputPath: planOutputPath,
        };

        const result = await validateInfrastructure(validateOptions);

        spinner.stop();

        // Step 2: Show validation results
        if (!options.json && options.verbose) {
          console.log(formatValidationResult(result));
        }

        if (!result.valid) {
          console.log(chalk.red("\n❌ Validation failed! Cannot generate plan.\n"));
          if (!options.verbose) {
            console.log(chalk.yellow("💡 Run with --verbose to see detailed validation errors\n"));
          }
          process.exit(1);
        }

        if (!options.verbose) {
          console.log(chalk.green("✅ Validation passed\n"));
        }

        // Step 3: Load and display plan
        spinner.start("Loading execution plan...");

        const plan = loadPlan(planOutputPath);

        if (!plan) {
          spinner.fail("Failed to load execution plan");
          console.log(chalk.red(`\n❌ Could not load plan from: ${planOutputPath}\n`));
          process.exit(1);
        }

        spinner.succeed("Execution plan loaded");

        // Step 4: Display plan summary
        if (options.json) {
          console.log(JSON.stringify(plan, null, 2));
        } else {
          displayPlanSummary(plan, {
            showResources: options.showResources || false,
            showExecutionOrder: options.showExecutionOrder || false,
          });

          console.log(chalk.gray(`\n📄 Plan saved to: ${planOutputPath}\n`));

          // Helpful next steps
          console.log(chalk.blue("Next steps:"));
          console.log(chalk.gray(`  • Review plan:  soverstack plan ${platformYaml} --show-resources`));
          console.log(chalk.gray(`  • Visualize:    soverstack graph ${platformYaml} --type plan --open`));
          console.log(chalk.gray(`  • Apply:        soverstack apply ${platformYaml}\n`));
        }
      } catch (error) {
        console.log(chalk.red("\n❌ Plan generation failed!\n"));
        console.log(chalk.red((error as Error).message));
        if (options.verbose) {
          console.log(chalk.gray((error as Error).stack));
        }
        process.exit(1);
      }
    }
  );

/**
 * Display a formatted plan summary
 */
function displayPlanSummary(
  plan: InfrastructurePlan,
  options: { showResources: boolean; showExecutionOrder: boolean }
): void {
  console.log(chalk.blue("\n📊 Execution Plan Summary\n"));

  // Environment info
  console.log(chalk.cyan("Infrastructure:"));
  console.log(chalk.gray(`  • Tier: ${plan.infrastructure_tier}`));
  console.log(chalk.gray(`  • Generated at: ${new Date(plan.generated_at).toLocaleString()}\n`));

  // Changes summary
  console.log(chalk.cyan("Changes:\n"));

  const { to_create, to_update, to_delete, no_change } = plan.summary;
  const totalChanges = to_create + to_update + to_delete;

  if (totalChanges === 0) {
    console.log(chalk.gray("  No changes detected. Infrastructure is up to date.\n"));
    return;
  }

  if (to_create > 0) {
    console.log(chalk.green(`  ➕ ${to_create} resource(s) to create`));
  }
  if (to_update > 0) {
    console.log(chalk.yellow(`  🔄 ${to_update} resource(s) to update`));
  }
  if (to_delete > 0) {
    console.log(chalk.red(`  🗑️  ${to_delete} resource(s) to delete`));
  }
  if (no_change > 0) {
    console.log(chalk.gray(`  ➖ ${no_change} resource(s) unchanged`));
  }

  console.log(chalk.bold(`\n  Total: ${totalChanges} change(s)\n`));

  // Changes by layer
  const changesByLayer = groupChangesByLayer(plan);

  if (Object.keys(changesByLayer).length > 0) {
    console.log(chalk.cyan("Changes by layer:\n"));

    Object.entries(changesByLayer).forEach(([layer, stats]) => {
      const layerTotal = stats.create + stats.update + stats.delete;
      if (layerTotal > 0) {
        console.log(chalk.bold(`  ${layer.toUpperCase()}:`));

        if (stats.create > 0) {
          console.log(chalk.green(`    ➕ Create: ${stats.create}`));
        }
        if (stats.update > 0) {
          console.log(chalk.yellow(`    🔄 Update: ${stats.update}`));
        }
        if (stats.delete > 0) {
          console.log(chalk.red(`    🗑️  Delete: ${stats.delete}`));
        }
      }
    });

    console.log();
  }

  // Detailed resource list
  if (options.showResources) {
    console.log(chalk.cyan("Resources:\n"));

    const resourcesByAction = {
      create: plan.resources.filter((r) => r.action === "create"),
      update: plan.resources.filter((r) => r.action === "update"),
      delete: plan.resources.filter((r) => r.action === "delete"),
    };

    if (resourcesByAction.create.length > 0) {
      console.log(chalk.green("  Create:\n"));
      resourcesByAction.create.forEach((r) => {
        console.log(chalk.gray(`    ➕ ${r.type} - ${r.id} (${r.layer})`));
      });
      console.log();
    }

    if (resourcesByAction.update.length > 0) {
      console.log(chalk.yellow("  Update:\n"));
      resourcesByAction.update.forEach((r) => {
        console.log(chalk.gray(`    🔄 ${r.type} - ${r.id} (${r.layer})`));
      });
      console.log();
    }

    if (resourcesByAction.delete.length > 0) {
      console.log(chalk.red("  Delete:\n"));
      resourcesByAction.delete.forEach((r) => {
        console.log(chalk.gray(`    🗑️  ${r.type} - ${r.id} (${r.layer})`));
      });
      console.log();
    }
  }

  // Execution order
  if (options.showExecutionOrder && plan.execution_order.length > 0) {
    console.log(chalk.cyan("Execution order:\n"));

    plan.execution_order.forEach((group, index) => {
      console.log(chalk.bold(`  Stage ${index + 1}:`));
      group.forEach((resourceId) => {
        const resource = plan.resources.find((r) => r.id === resourceId);
        if (resource) {
          const icon = getActionIcon(resource.action);
          console.log(chalk.gray(`    ${icon} ${resourceId} (${resource.type})`));
        }
      });
      console.log();
    });
  }
}

/**
 * Group changes by layer
 */
function groupChangesByLayer(plan: InfrastructurePlan): Record<
  string,
  { create: number; update: number; delete: number; noChange: number }
> {
  const layers: Record<string, { create: number; update: number; delete: number; noChange: number }> = {};

  plan.resources.forEach((resource) => {
    if (!layers[resource.layer]) {
      layers[resource.layer] = { create: 0, update: 0, delete: 0, noChange: 0 };
    }

    switch (resource.action) {
      case "create":
        layers[resource.layer].create++;
        break;
      case "update":
        layers[resource.layer].update++;
        break;
      case "delete":
        layers[resource.layer].delete++;
        break;
      case "no-op":
        layers[resource.layer].noChange++;
        break;
    }
  });

  return layers;
}

/**
 * Get icon for action
 */
function getActionIcon(action: string): string {
  switch (action) {
    case "create":
      return "➕";
    case "update":
      return "🔄";
    case "delete":
      return "🗑️";
    default:
      return "➖";
  }
}
