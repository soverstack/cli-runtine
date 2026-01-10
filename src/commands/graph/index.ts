import { Command } from "commander";
import chalk from "chalk";
import { generateInfrastructureGraph, GraphOptions } from "./logic";

export const graphCommand = new Command("graph")
  .description("Generate interactive Mermaid.js diagrams of infrastructure")
  .argument("<platform-yaml>", "Path to platform.yaml file")
  .option("-o, --output <path>", "Output file path (default: .soverstack/graph.html)")
  .option(
    "-t, --type <type>",
    "Graph type: plan, state, dependencies, or all (default: all)",
    "all"
  )
  .option(
    "-f, --format <format>",
    "Output format: html or mermaid (default: html)",
    "html"
  )
  .option("--open", "Open HTML graph in browser after generation")
  .action(
    async (
      platformYaml: string,
      options: {
        output?: string;
        type?: "plan" | "state" | "dependencies" | "all";
        format?: "html" | "mermaid";
        open?: boolean;
      }
    ) => {
      try {
        const graphOptions: GraphOptions = {
          platformYamlPath: platformYaml,
          outputPath: options.output,
          type: options.type,
          format: options.format,
          open: options.open,
        };

        const success = await generateInfrastructureGraph(graphOptions);

        if (!success) {
          process.exit(1);
        }
      } catch (error) {
        console.log(chalk.red("\n❌ Graph generation failed!\n"));
        console.log(chalk.red((error as Error).message));
        console.log(chalk.gray((error as Error).stack));
        process.exit(1);
      }
    }
  );
