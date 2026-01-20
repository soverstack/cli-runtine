import { Command } from "commander";
import chalk from "chalk";
import inquirer from "inquirer";
import { ProjectInitializer } from "./logic";
import { InitOptions } from "./utils";
import { InfrastructureTierType, ComplianceLevel } from "@/types";
import { COMPLIANCE_DESCRIPTIONS } from "../../constants";

export const initCommand = new Command("init")
  .description("Initialize a new Soverstack project")
  .argument("[project-name]", "Name of the project")
  .option("--dc <datacenters>", "Comma-separated list of datacenters (e.g., paris,frankfurt)")
  .option("--tier <tier>", "Infrastructure tier: local, production, or enterprise")
  .option("--generate-ssh", "Generate SSH keys", false)
  .action(
    async (
      projectName: string | undefined,
      options: {
        dc?: string;
        tier?: string;
        generateSsh: boolean;
      }
    ) => {
      try {
        // Header
        console.log("");
        console.log(chalk.cyan.bold("  ╔═══════════════════════════════════════════════════════════════════╗"));
        console.log(chalk.cyan.bold("  ║") + chalk.white.bold("                      🚀 SOVERSTACK INIT                           ") + chalk.cyan.bold("║"));
        console.log(chalk.cyan.bold("  ║") + chalk.gray("                 Sovereign Infrastructure Setup                    ") + chalk.cyan.bold("║"));
        console.log(chalk.cyan.bold("  ╚═══════════════════════════════════════════════════════════════════╝"));
        console.log("");

        // ═══════════════════════════════════════════════════════════════════
        // PHASE 1: Basic project info
        // ═══════════════════════════════════════════════════════════════════
        const phase1Prompts: any[] = [];

        // Project name prompt
        if (!projectName) {
          phase1Prompts.push({
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

        // Domain prompt
        phase1Prompts.push({
          type: "input",
          name: "domain",
          message: "Domain name:",
          default: "example.com",
          validate: (input: string) => {
            if (!input || input.trim().length === 0) {
              return "Domain is required";
            }
            // Basic domain validation
            if (!/^[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,}$/i.test(input)) {
              return "Invalid domain format (e.g., example.com)";
            }
            return true;
          },
        });

        // Infrastructure tier prompt
        if (!options.tier) {
          phase1Prompts.push({
            type: "list",
            name: "infrastructureTier",
            message: "Infrastructure tier:",
            choices: [
              {
                name: "Local Lab - Single node, HA optional",
                value: "local",
                short: "Local",
              },
              {
                name: "Production - 3+ servers, HA enforced",
                value: "production",
                short: "Production",
              },
              {
                name: "Enterprise - 5+ servers, HA + Backup enforced",
                value: "enterprise",
                short: "Enterprise",
              },
            ],
            default: "production",
          });
        }

        // Run phase 1 prompts
        const phase1Answers = phase1Prompts.length > 0 ? await inquirer.prompt(phase1Prompts) : {};

        // ═══════════════════════════════════════════════════════════════════
        // PHASE 2: Security level (with info box displayed just before)
        // ═══════════════════════════════════════════════════════════════════
        console.log("");
        console.log(chalk.gray("  ┌─────────────────────────────────────────────────────────────────────┐"));
        console.log(chalk.gray("  │  ") + chalk.cyan.bold("ℹ️  SECURITY LEVEL") + chalk.gray("                                                 │"));
        console.log(chalk.gray("  ├─────────────────────────────────────────────────────────────────────┤"));
        console.log(chalk.gray("  │                                                                     │"));
        console.log(chalk.gray("  │  Security level determines which protections are enabled.           │"));
        console.log(chalk.gray("  │  Higher levels require more resources (VMs, storage, CPU).          │"));
        console.log(chalk.gray("  │                                                                     │"));
        console.log(chalk.gray("  │  ") + chalk.white("Which one fits your needs?") + chalk.gray("                                         │"));
        console.log(chalk.gray("  │                                                                     │"));
        console.log(chalk.gray("  │    • Prototype or personal project?      → ") + chalk.yellow("Essential") + chalk.gray("                │"));
        console.log(chalk.gray("  │    • SaaS with real users?               → ") + chalk.yellow("Standard") + chalk.gray("                 │"));
        console.log(chalk.gray("  │    • Enterprise with sensitive data?     → ") + chalk.yellow("Advanced") + chalk.gray("                 │"));
        console.log(chalk.gray("  │    • Bank, healthcare, regulated?        → ") + chalk.yellow("Regulated") + chalk.gray("                │"));
        console.log(chalk.gray("  │                                                                     │"));
        console.log(chalk.gray("  │  ") + chalk.green("💡 Start simple. You can always upgrade later.") + chalk.gray("                     │"));
        console.log(chalk.gray("  │                                                                     │"));
        console.log(chalk.gray("  └─────────────────────────────────────────────────────────────────────┘"));
        console.log("");

        const phase2Answers = await inquirer.prompt([
          {
            type: "list",
            name: "complianceLevel",
            message: "Security level:",
            choices: [
              {
                name: `${COMPLIANCE_DESCRIPTIONS.startup.label} - ${COMPLIANCE_DESCRIPTIONS.startup.description}`,
                value: "startup",
                short: COMPLIANCE_DESCRIPTIONS.startup.label,
              },
              {
                name: `${COMPLIANCE_DESCRIPTIONS.business.label} - ${COMPLIANCE_DESCRIPTIONS.business.description}`,
                value: "business",
                short: COMPLIANCE_DESCRIPTIONS.business.label,
              },
              {
                name: `${COMPLIANCE_DESCRIPTIONS.enterprise.label} - ${COMPLIANCE_DESCRIPTIONS.enterprise.description}`,
                value: "enterprise",
                short: COMPLIANCE_DESCRIPTIONS.enterprise.label,
              },
              {
                name: `${COMPLIANCE_DESCRIPTIONS.regulated.label} - ${COMPLIANCE_DESCRIPTIONS.regulated.description}`,
                value: "regulated",
                short: COMPLIANCE_DESCRIPTIONS.regulated.label,
              },
            ],
            default: "startup",
          },
        ]);

        // ═══════════════════════════════════════════════════════════════════
        // PHASE 3: Remaining options
        // ═══════════════════════════════════════════════════════════════════
        const phase3Prompts: any[] = [];

        // Datacenter prompt
        if (!options.dc) {
          phase3Prompts.push({
            type: "input",
            name: "datacenters",
            message: "Datacenter name(s) (comma-separated for multi-DC, e.g., paris,frankfurt):",
            default: "main",
            validate: (input: string) => {
              if (!input || input.trim().length === 0) {
                return "At least one datacenter is required";
              }
              const dcs = input.split(",").map((dc) => dc.trim()).filter((dc) => dc.length > 0);
              if (dcs.length === 0) {
                return "At least one datacenter is required";
              }
              const invalidDc = dcs.find((dc) => !/^[a-z0-9-]+$/.test(dc));
              if (invalidDc) {
                return `Invalid datacenter name: ${invalidDc}. Use only lowercase letters, numbers, and hyphens`;
              }
              return true;
            },
          });
        }

        // SSH keys prompt
        if (!options.generateSsh) {
          phase3Prompts.push({
            type: "confirm",
            name: "generateSshKeys",
            message: "Generate SSH keys?",
            default: false,
          });
        }

        // Run phase 3 prompts
        const phase3Answers = phase3Prompts.length > 0 ? await inquirer.prompt(phase3Prompts) : {};

        // Merge all answers
        const answers = { ...phase1Answers, ...phase2Answers, ...phase3Answers };

        // Final values
        const finalProjectName = projectName || answers.projectName || "my-soverstack-project";
        const finalDomain = answers.domain || "example.com";
        const finalTier = options.tier || answers.infrastructureTier || "production";
        const finalComplianceLevel = answers.complianceLevel || "startup";
        const finalDatacenters = options.dc || answers.datacenters || "main";
        const finalGenerateSsh = options.generateSsh || answers.generateSshKeys || false;

        // Validate tier
        if (!["local", "production", "enterprise"].includes(finalTier)) {
          console.log(chalk.red("Invalid tier. Must be 'local', 'production', or 'enterprise'"));
          process.exit(1);
        }

        // Parse datacenters
        const datacenters = finalDatacenters
          .split(",")
          .map((dc: string) => dc.trim())
          .filter((dc: string) => dc.length > 0);

        if (datacenters.length === 0) {
          console.log(chalk.red("At least one datacenter is required."));
          process.exit(1);
        }

        // Validate datacenter names
        const invalidDc = datacenters.find((dc: string) => !/^[a-z0-9-]+$/.test(dc));
        if (invalidDc) {
          console.log(chalk.red(`Invalid datacenter name: ${invalidDc}`));
          process.exit(1);
        }

        // Create initialization options
        const initOptions: InitOptions = {
          projectName: finalProjectName,
          domain: finalDomain,
          datacenters,
          generateSshKeys: finalGenerateSsh,
          infrastructureTier: finalTier as InfrastructureTierType,
          complianceLevel: finalComplianceLevel as ComplianceLevel,
        };

        // Initialize project
        const initializer = new ProjectInitializer(initOptions);
        await initializer.initialize();
      } catch (error) {
        console.log(chalk.red("\nInitialization failed:"));
        console.log(chalk.red((error as Error).message));
        process.exit(1);
      }
    }
  );
