import { Command } from "commander";
import chalk from "chalk";
import inquirer from "inquirer";
import { ProjectInitializer } from "./logic";
import { InitOptions, RegionConfig } from "./utils";
import { InfrastructureTierType, ComplianceLevel } from "@/types";
import { COMPLIANCE_DESCRIPTIONS } from "../../constants";

export const initCommand = new Command("init")
  .description("Initialize a new Soverstack project")
  .argument("[project-name]", "Name of the project")
  .option("--domain <domain>", "Domain name (e.g., example.com)")
  .option("--tier <tier>", "Infrastructure tier: local, production, or enterprise")
  .option("--compliance <level>", "Compliance level: startup, business, enterprise, regulated")
  .option("--regions <regions>", "Regions and zones (e.g., 'eu:main,dr;us:east' or 'eu:main')")
  .option("--generate-ssh", "Generate SSH keys", false)
  .option("--non-interactive", "Skip interactive prompts (use defaults)", false)
  .action(
    async (
      projectName: string | undefined,
      options: {
        domain?: string;
        tier?: string;
        compliance?: string;
        regions?: string;
        generateSsh: boolean;
        nonInteractive: boolean;
      }
    ) => {
      try {
        // Header
        console.log("");
        console.log(chalk.cyan.bold("  ╔═══════════════════════════════════════════════════════════════════╗"));
        console.log(chalk.cyan.bold("  ║") + chalk.white.bold("                      SOVERSTACK INIT                              ") + chalk.cyan.bold("║"));
        console.log(chalk.cyan.bold("  ║") + chalk.gray("                 Sovereign Infrastructure Setup                    ") + chalk.cyan.bold("║"));
        console.log(chalk.cyan.bold("  ╚═══════════════════════════════════════════════════════════════════╝"));
        console.log("");

        // Non-interactive mode: use defaults
        if (options.nonInteractive) {
          // Parse --regions option: "eu:main,dr;us:east" → [{name: "eu", zones: ["main", "dr"]}, {name: "us", zones: ["east"]}]
          let regions: RegionConfig[] = [{ name: "eu", zones: ["main"] }];
          if (options.regions) {
            regions = options.regions.split(";").map((regionStr) => {
              const [name, zonesStr] = regionStr.split(":");
              const zones = zonesStr ? zonesStr.split(",").map((z) => z.trim()) : ["main"];
              return { name: name.trim(), zones };
            });
          }

          const primaryRegion = regions[0].name;
          const primaryZone = regions[0].zones[0];

          const initOptions: InitOptions = {
            projectName: projectName || "my-soverstack-project",
            domain: options.domain || "example.com",
            regions,
            primaryRegion,
            primaryZone,
            generateSshKeys: options.generateSsh,
            infrastructureTier: (options.tier as InfrastructureTierType) || "production",
            complianceLevel: (options.compliance as ComplianceLevel) || "startup",
          };

          const initializer = new ProjectInitializer(initOptions);
          await initializer.initialize();
          return;
        }

        // ═══════════════════════════════════════════════════════════════════
        // PHASE 1: Basic project info
        // ═══════════════════════════════════════════════════════════════════
        const phase1Prompts: any[] = [];

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

        if (!options.domain) {
          phase1Prompts.push({
            type: "input",
            name: "domain",
            message: "Domain name:",
            default: "example.com",
            validate: (input: string) => {
              if (!input || input.trim().length === 0) {
                return "Domain is required";
              }
              if (!/^[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,}$/i.test(input)) {
                return "Invalid domain format (e.g., example.com)";
              }
              return true;
            },
          });
        }

        if (!options.tier) {
          phase1Prompts.push({
            type: "list",
            name: "infrastructureTier",
            message: "Infrastructure tier:",
            choices: [
              { name: "Local Lab - Single node, HA optional", value: "local", short: "Local" },
              { name: "Production - 3+ servers, HA enforced", value: "production", short: "Production" },
              { name: "Enterprise - 5+ servers, HA + Backup enforced", value: "enterprise", short: "Enterprise" },
            ],
            default: "production",
          });
        }

        const phase1Answers = phase1Prompts.length > 0 ? await inquirer.prompt(phase1Prompts) : {};

        // ═══════════════════════════════════════════════════════════════════
        // PHASE 2: Security level
        // ═══════════════════════════════════════════════════════════════════
        let phase2Answers: any = {};

        if (!options.compliance) {
          console.log("");
          console.log(chalk.gray("  ┌─────────────────────────────────────────────────────────────────────┐"));
          console.log(chalk.gray("  │  ") + chalk.cyan.bold("SECURITY LEVEL") + chalk.gray("                                                     │"));
          console.log(chalk.gray("  ├─────────────────────────────────────────────────────────────────────┤"));
          console.log(chalk.gray("  │                                                                     │"));
          console.log(chalk.gray("  │    Prototype or personal project?      → ") + chalk.yellow("Essential") + chalk.gray("                │"));
          console.log(chalk.gray("  │    SaaS with real users?               → ") + chalk.yellow("Standard") + chalk.gray("                 │"));
          console.log(chalk.gray("  │    Enterprise with sensitive data?     → ") + chalk.yellow("Advanced") + chalk.gray("                 │"));
          console.log(chalk.gray("  │    Bank, healthcare, regulated?        → ") + chalk.yellow("Regulated") + chalk.gray("                │"));
          console.log(chalk.gray("  │                                                                     │"));
          console.log(chalk.gray("  └─────────────────────────────────────────────────────────────────────┘"));
          console.log("");

          phase2Answers = await inquirer.prompt([
            {
              type: "list",
              name: "complianceLevel",
              message: "Security level:",
              choices: [
                { name: `${COMPLIANCE_DESCRIPTIONS.startup.label} - ${COMPLIANCE_DESCRIPTIONS.startup.description}`, value: "startup", short: COMPLIANCE_DESCRIPTIONS.startup.label },
                { name: `${COMPLIANCE_DESCRIPTIONS.business.label} - ${COMPLIANCE_DESCRIPTIONS.business.description}`, value: "business", short: COMPLIANCE_DESCRIPTIONS.business.label },
                { name: `${COMPLIANCE_DESCRIPTIONS.enterprise.label} - ${COMPLIANCE_DESCRIPTIONS.enterprise.description}`, value: "enterprise", short: COMPLIANCE_DESCRIPTIONS.enterprise.label },
                { name: `${COMPLIANCE_DESCRIPTIONS.regulated.label} - ${COMPLIANCE_DESCRIPTIONS.regulated.description}`, value: "regulated", short: COMPLIANCE_DESCRIPTIONS.regulated.label },
              ],
              default: "startup",
            },
          ]);
        }

        // ═══════════════════════════════════════════════════════════════════
        // PHASE 3: Regions
        // ═══════════════════════════════════════════════════════════════════
        console.log("");
        console.log(chalk.gray("  ┌─────────────────────────────────────────────────────────────────────┐"));
        console.log(chalk.gray("  │  ") + chalk.cyan.bold("REGIONS & ZONES") + chalk.gray("                                                    │"));
        console.log(chalk.gray("  ├─────────────────────────────────────────────────────────────────────┤"));
        console.log(chalk.gray("  │                                                                     │"));
        console.log(chalk.gray("  │  A ") + chalk.white("region") + chalk.gray(" is a geographic area (e.g., eu, us, asia).              │"));
        console.log(chalk.gray("  │  Each region contains ") + chalk.white("zones") + chalk.gray(" (Proxmox clusters).                   │"));
        console.log(chalk.gray("  │                                                                     │"));
        console.log(chalk.gray("  │  Example: region=eu, zones=main,dr                                  │"));
        console.log(chalk.gray("  │                                                                     │"));
        console.log(chalk.gray("  └─────────────────────────────────────────────────────────────────────┘"));
        console.log("");

        const { regionNames } = await inquirer.prompt([
          {
            type: "input",
            name: "regionNames",
            message: "Region names (comma-separated, e.g., eu,us):",
            default: "eu",
            validate: (input: string) => {
              if (!input || input.trim().length === 0) {
                return "At least one region is required";
              }
              const regions = input.split(",").map((r) => r.trim()).filter((r) => r.length > 0);
              if (regions.length === 0) {
                return "At least one region is required";
              }
              const invalid = regions.find((r) => !/^[a-z0-9-]+$/.test(r));
              if (invalid) {
                return `Invalid region name: ${invalid}. Use only lowercase letters, numbers, and hyphens`;
              }
              return true;
            },
          },
        ]);

        const regionNameList = regionNames.split(",").map((r: string) => r.trim()).filter((r: string) => r.length > 0);

        // ═══════════════════════════════════════════════════════════════════
        // PHASE 4: Zones for each region
        // ═══════════════════════════════════════════════════════════════════
        const regions: RegionConfig[] = [];

        for (const regionName of regionNameList) {
          console.log("");
          const { zoneNames } = await inquirer.prompt([
            {
              type: "input",
              name: "zoneNames",
              message: `Zones for region ${chalk.cyan(regionName)} (comma-separated, e.g., main,dr):`,
              default: "main",
              validate: (input: string) => {
                if (!input || input.trim().length === 0) {
                  return "At least one zone is required";
                }
                const zones = input.split(",").map((z) => z.trim()).filter((z) => z.length > 0);
                if (zones.length === 0) {
                  return "At least one zone is required";
                }
                const invalid = zones.find((z) => !/^[a-z0-9-]+$/.test(z));
                if (invalid) {
                  return `Invalid zone name: ${invalid}. Use only lowercase letters, numbers, and hyphens`;
                }
                return true;
              },
            },
          ]);

          const zoneList = zoneNames.split(",").map((z: string) => z.trim()).filter((z: string) => z.length > 0);
          regions.push({ name: regionName, zones: zoneList });
        }

        // ═══════════════════════════════════════════════════════════════════
        // PHASE 5: Select primary zone (control plane)
        // ═══════════════════════════════════════════════════════════════════
        // Build list of all zones with region prefix
        const allZones: { name: string; value: { region: string; zone: string } }[] = [];
        for (const region of regions) {
          for (const zone of region.zones) {
            allZones.push({
              name: `${region.name}/${zone}`,
              value: { region: region.name, zone },
            });
          }
        }

        let primaryRegion = regions[0].name;
        let primaryZone = regions[0].zones[0];

        if (allZones.length > 1) {
          console.log("");
          console.log(chalk.gray("  ┌─────────────────────────────────────────────────────────────────────┐"));
          console.log(chalk.gray("  │  ") + chalk.cyan.bold("PRIMARY ZONE (Control Plane)") + chalk.gray("                                   │"));
          console.log(chalk.gray("  ├─────────────────────────────────────────────────────────────────────┤"));
          console.log(chalk.gray("  │                                                                     │"));
          console.log(chalk.gray("  │  The primary zone hosts global services:                            │"));
          console.log(chalk.gray("  │  Vault, Keycloak, PostgreSQL, Grafana, etc.                         │"));
          console.log(chalk.gray("  │                                                                     │"));
          console.log(chalk.gray("  └─────────────────────────────────────────────────────────────────────┘"));
          console.log("");

          const { primary } = await inquirer.prompt([
            {
              type: "list",
              name: "primary",
              message: "Which zone is primary (hosts control plane)?",
              choices: allZones,
              default: allZones[0].value,
            },
          ]);

          primaryRegion = primary.region;
          primaryZone = primary.zone;
        }

        // ═══════════════════════════════════════════════════════════════════
        // PHASE 6: SSH keys
        // ═══════════════════════════════════════════════════════════════════
        let generateSshKeys = options.generateSsh;
        if (!options.generateSsh) {
          const { generateSsh } = await inquirer.prompt([
            {
              type: "confirm",
              name: "generateSsh",
              message: "Generate SSH keys?",
              default: false,
            },
          ]);
          generateSshKeys = generateSsh;
        }

        // ═══════════════════════════════════════════════════════════════════
        // Final values
        // ═══════════════════════════════════════════════════════════════════
        const finalProjectName = projectName || phase1Answers.projectName || "my-soverstack-project";
        const finalDomain = options.domain || phase1Answers.domain || "example.com";
        const finalTier = options.tier || phase1Answers.infrastructureTier || "production";
        const finalComplianceLevel = options.compliance || phase2Answers.complianceLevel || "startup";

        if (!["local", "production", "enterprise"].includes(finalTier)) {
          console.log(chalk.red("Invalid tier. Must be 'local', 'production', or 'enterprise'"));
          process.exit(1);
        }

        // Create initialization options
        const initOptions: InitOptions = {
          projectName: finalProjectName,
          domain: finalDomain,
          regions,
          primaryRegion,
          primaryZone,
          generateSshKeys,
          infrastructureTier: finalTier as InfrastructureTierType,
          complianceLevel: finalComplianceLevel as ComplianceLevel,
        };

        // Show summary
        console.log("");
        console.log(chalk.gray("  ┌─────────────────────────────────────────────────────────────────────┐"));
        console.log(chalk.gray("  │  ") + chalk.cyan.bold("SUMMARY") + chalk.gray("                                                            │"));
        console.log(chalk.gray("  ├─────────────────────────────────────────────────────────────────────┤"));
        console.log(chalk.gray("  │  Project:    ") + chalk.white(finalProjectName.padEnd(53)) + chalk.gray("│"));
        console.log(chalk.gray("  │  Domain:     ") + chalk.white(finalDomain.padEnd(53)) + chalk.gray("│"));
        console.log(chalk.gray("  │  Tier:       ") + chalk.white(finalTier.padEnd(53)) + chalk.gray("│"));
        console.log(chalk.gray("  │  Primary:    ") + chalk.cyan(`${primaryRegion}/${primaryZone}`.padEnd(53)) + chalk.gray("│"));
        console.log(chalk.gray("  │  Regions:    ") + chalk.white(regions.map((r) => `${r.name}(${r.zones.join(",")})`).join(" ").padEnd(53)) + chalk.gray("│"));
        console.log(chalk.gray("  └─────────────────────────────────────────────────────────────────────┘"));
        console.log("");

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
