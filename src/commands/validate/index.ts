import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import { validateInfrastructure, ValidateOptions } from "./logic";
import { formatValidationResult, formatValidationJson } from "./utils/error-formatter";
import { LayerType } from "@/types";

export const validateCommand = new Command("validate")
  .description("Validate Soverstack infrastructure configuration")
  .argument("<platform-yaml>", "Path to platform.yaml file")
  .option(
    "--layer <layer>",
    "Validate only a specific layer (datacenter, compute, cluster, feature, firewall, bastion)"
  )
  .option("--json", "Output results in JSON format")
  .option("--verbose", "Show detailed validation information")
  .option("--plan", "Generate execution plan after successful validation")
  .option("--plan-output <path>", "Path to save execution plan (default: .soverstack/plan.yaml)")
  .action(
    async (
      platformYaml: string,
      options: {
        layer?: LayerType;
        json?: boolean;
        verbose?: boolean;
        plan?: boolean;
        planOutput?: string;
      }
    ) => {
      try {
        const spinner = ora("Validating configuration...").start();

        const validateOptions: ValidateOptions = {
          platformYamlPath: platformYaml,
          layer: options.layer,
          verbose: options.verbose,
          generatePlan: options.plan,
          planOutputPath: options.planOutput,
        };

        const result = await validateInfrastructure(validateOptions);

        spinner.stop();

        // Output results
        if (options.json) {
          console.log(formatValidationJson(result));
        } else {
          console.log(formatValidationResult(result));
        }

        // Exit with appropriate code
        if (!result.valid) {
          process.exit(1);
        }
      } catch (error) {
        console.log(chalk.red("\n❌ Validation crashed!\n"));
        console.log(chalk.red((error as Error).message));
        console.log(chalk.gray((error as Error).stack));
        process.exit(1);
      }
    }
  );
