import { Command } from "commander";
import chalk from "chalk";
import { applyInfrastructure, ApplyOptions } from "./logic";

export const applyCommand = new Command("apply")
  .description("Apply infrastructure changes based on execution plan")
  .argument("<platform-yaml>", "Path to platform.yaml file")
  .option("--plan <path>", "Path to execution plan (default: .soverstack/plan.yaml)")
  .option("--auto-approve", "Skip interactive approval")
  .option("--docker-image <image>", "Docker image to use (default: soverstack/terraform-ansible:latest)")
  .option("--skip-validation", "Skip validation before apply (not recommended)")
  .action(
    async (
      platformYaml: string,
      options: {
        plan?: string;
        autoApprove?: boolean;
        dockerImage?: string;
        skipValidation?: boolean;
      }
    ) => {
      try {
        const applyOptions: ApplyOptions = {
          platformYamlPath: platformYaml,
          planPath: options.plan,
          autoApprove: options.autoApprove,
          dockerImage: options.dockerImage,
          skipValidation: options.skipValidation,
        };

        const success = await applyInfrastructure(applyOptions);

        if (!success) {
          process.exit(1);
        }
      } catch (error) {
        console.log(chalk.red("\n❌ Apply failed!\n"));
        console.log(chalk.red((error as Error).message));
        console.log(chalk.gray((error as Error).stack));
        process.exit(1);
      }
    }
  );
