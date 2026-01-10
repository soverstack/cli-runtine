import { Command } from "commander";
import chalk from "chalk";
import { destroyInfrastructure, DestroyOptions } from "./logic";

export const destroyCommand = new Command("destroy")
  .description("Destroy infrastructure managed by Soverstack")
  .argument("<platform-yaml>", "Path to platform.yaml file")
  .option("--auto-approve", "Skip interactive approval (DANGEROUS!)")
  .option("--docker-image <image>", "Docker image to use (default: soverstack/terraform-ansible:latest)")
  .option("--target <resource>", "Destroy specific resource only")
  .action(
    async (
      platformYaml: string,
      options: {
        autoApprove?: boolean;
        dockerImage?: string;
        target?: string;
      }
    ) => {
      try {
        const destroyOptions: DestroyOptions = {
          platformYamlPath: platformYaml,
          autoApprove: options.autoApprove,
          dockerImage: options.dockerImage,
          target: options.target,
        };

        const success = await destroyInfrastructure(destroyOptions);

        if (!success) {
          process.exit(1);
        }
      } catch (error) {
        console.log(chalk.red("\n❌ Destroy failed!\n"));
        console.log(chalk.red((error as Error).message));
        console.log(chalk.gray((error as Error).stack));
        process.exit(1);
      }
    }
  );
