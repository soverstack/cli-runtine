import { Command } from "commander";
import chalk from "chalk";
import inquirer from "inquirer";
import { ProjectInitializer } from "./logic";
import { InitOptions } from "./utils";
import { InfrastructureTierType } from "@/types";

export const initCommand = new Command("init")
  .description("Initialize a new Soverstack project")
  .argument("[project-name]", "Name of the project")
  .option(
    "--env <environments>",
    "Comma-separated list of environments (optional, e.g., prod,dev,staging)"
  )
  // .option("--mode <mode>", "Project mode: simple or advanced", "")
  .option("--tier <tier>", "Infrastructure tier: local, production, or enterprise")
  .option("--generate-ssh", "Generate SSH keys", false)
  .action(
    async (
      projectName: string | undefined,
      options: {
        env?: string;
        mode: string;
        tier?: string;
        generateSsh: boolean;
      }
    ) => {
      try {
        // Interactive prompts if values not provided
        const prompts: any[] = [];

        // Project name prompt
        if (!projectName) {
          prompts.push({
            type: "input",
            name: "projectName",
            message: "Project name:",
            default: "my-soverstack-project",
            validate: (input: string) => {
              if (!input || input.trim().length === 0) {
                return "Project name is required";
              }
              if (!/^[a-z0-9-]+$/.test(input)) {
                return "Project name must contain only lowercase letters, numbers, and hyphens";
              }
              return true;
            },
          });
        }

        // Infrastructure tier prompt
        if (!options.tier) {
          prompts.push({
            type: "list",
            name: "infrastructureTier",
            message: "What is your infrastructure target?",
            choices: [
              {
                name: "🟢 Local Lab / Single Node - Multi-network supported, HA optional, security enforced",
                value: "local",
                short: "Local Lab",
              },
              {
                name: "🟡 Production Standard - 3 networks (Public, Internal, Storage), HA enforced, security enforced",
                value: "production",
                short: "Production",
              },
              {
                name: "🔴 Enterprise HA - 5 networks (Full isolation), HA enforced, security enforced",
                value: "enterprise",
                short: "Enterprise",
              },
            ],
            default: "production",
          });
        }

        // // Mode
        // if (!options.mode) {
        //   prompts.push({
        //     type: "list",
        //     name: "mode",
        //     message: "What is your project mode?",
        //     choices: [
        //       {
        //         name: "Simple - Minimal setup, no advanced features",
        //         value: "simple",
        //         short: "Simple",
        //       },
        //       {
        //         name: "Advanced - Full feature set, including advanced networking and security",
        //         value: "advanced",
        //         short: "Advanced",
        //       },
        //     ],
        //     default: "advanced",
        //   });
        // }

        if (!options.env) {
          prompts.push({
            type: "input",
            name: "environments",
            message: "Comma-separated list of environments (optional):",
            default: "",
          });
        }
        if (!options.generateSsh) {
          prompts.push({
            type: "confirm",
            name: "generateSshKeys",
            message: "Generate SSH keys?",
            default: false,
          });
        }
        // Run prompts if needed
        let answers: {
          projectName?: string;
          infrastructureTier?: string;
          mode?: string;
          generateSshKeys?: boolean;
          environments?: string;
        } = {};
        if (prompts.length > 0) {
          answers = await inquirer.prompt(prompts);
        }

        // Determine final values
        const finalProjectName = projectName || answers.projectName;
        const finalTier = options.tier || answers.infrastructureTier;
        const finalMode = "advanced";
        // const finalMode = options?.mode || answers.mode;

        const finalEnvironments = options.env || answers.environments;
        const finalGenerateSsh = options.generateSsh || answers.generateSshKeys;

        // // Validate mode
        // if (finalMode !== "simple" && finalMode !== "advanced") {
        //   console.log(chalk.red("❌ Invalid mode. Must be 'simple' or 'advanced'"));
        //   process.exit(1);
        // }

        // Validate tier if provided via CLI
        if (finalTier && !["local", "production", "enterprise"].includes(finalTier)) {
          console.log(chalk.red("❌ Invalid tier. Must be 'local', 'production', or 'enterprise'"));
          process.exit(1);
        }

        // Parse environments (optional)
        let environments: string[] | undefined = undefined;
        if (finalEnvironments) {
          environments = finalEnvironments.split(",").map((env) => env.trim());

          // Validate environment names
          const invalidEnv = environments.find((env) => !/^[a-z0-9-]+$/.test(env));
          if (invalidEnv) {
            console.log(
              chalk.red(
                `❌ Invalid environment name: ${invalidEnv}. Must contain only lowercase letters, numbers, and hyphens`
              )
            );
            process.exit(1);
          }
        }

        // Create initialization options
        const initOptions: InitOptions = {
          projectName: finalProjectName || "my-soverstack-project",
          environments,
          mode: finalMode as "simple" | "advanced",
          generateSshKeys: finalGenerateSsh,
          infrastructureTier: finalTier as InfrastructureTierType,
        };

        // Initialize project
        const initializer = new ProjectInitializer(initOptions);
        await initializer.initialize();
      } catch (error) {
        console.log(chalk.red("\n❌ Initialization failed:"));
        console.log(chalk.red((error as Error).message));
        process.exit(1);
      }
    }
  );
