/**
 * Add Region Command
 *
 * Add a new region to an existing project.
 */

import { Command } from "commander";
import chalk from "chalk";
import inquirer from "inquirer";
import path from "path";
import fs from "fs";
import yaml from "js-yaml";

import { scanProject, regionExists, findProjectRoot, ScannedRegion } from "./utils/scanner";
import { RegionConfig, GeneratorContext, getDatacenters } from "../init-v2/types";
import { InfrastructureTierType } from "@/types";

interface PlatformConfig {
  project_name: string;
  domain: string;
  infrastructure_tier: InfrastructureTierType;
  compliance_level?: string;
}

// Import generators
import {
  generateRegionYaml,
  generateNetworkYaml,
  generateNodesYaml,
  generateSshYaml,
  generateMonitoringYaml,
  generateBastionYaml,
  generateSiemYaml,
  generateFirewallYaml,
  generateLoadbalancerYaml,
  generateStorageYaml,
  generateBackupYaml,
} from "../init-v2/generators";

// ════════════════════════════════════════════════════════════════════════════
// COMMAND
// ════════════════════════════════════════════════════════════════════════════

export const addRegionCommand = new Command("region")
  .description("Add a new region to the project")
  .argument("[name]", "Name of the region (e.g., us, asia)")
  .option("--zones <zones>", "Zones to create (comma-separated)")
  .option("--generate-ssh-keys", "Generate SSH keys for new datacenters")
  .action(async (name: string | undefined, options: any) => {
    try {
      console.log("");
      console.log(chalk.cyan.bold("  ADD REGION"));
      console.log("");

      // Find project root
      const projectPath = findProjectRoot();
      if (!projectPath) {
        console.log(chalk.red("  Error: No platform.yaml found."));
        console.log(chalk.gray("  Run this command from your project directory."));
        process.exit(1);
      }

      // Scan existing project
      const project = scanProject(projectPath);

      // Read platform.yaml to get config
      const platformPath = path.join(projectPath, "platform.yaml");
      const platformContent = fs.readFileSync(platformPath, "utf-8");
      const platform = yaml.load(platformContent) as PlatformConfig;
      const tier = platform.infrastructure_tier || "production";
      const isLocal = tier === "local";

      // Show existing regions
      if (project.regions.length > 0) {
        console.log(chalk.white("  Existing regions:"));
        project.regions.forEach((r) => {
          const zoneNames = r.zones.map((z) => z.name).join(", ");
          const hubNames = r.hubs.map((h) => h.fullName).join(", ");
          console.log(chalk.gray(`    • ${r.name}`));
          if (r.hubs.length > 0) {
            console.log(chalk.dim(`      Hubs: ${hubNames}`));
          }
          console.log(chalk.dim(`      Zones: ${zoneNames || "(none)"}`));
        });
        console.log("");
      }

      // Get region name
      let regionName = name;
      if (!regionName) {
        const { inputName } = await inquirer.prompt([
          {
            type: "input",
            name: "inputName",
            message: "New region name:",
            validate: (input: string) => {
              if (!input) return "Required";
              if (!/^[a-z0-9-]+$/.test(input)) return "Lowercase, numbers, hyphens only";
              if (regionExists(projectPath, input)) return `Region '${input}' already exists`;
              return true;
            },
          },
        ]);
        regionName = inputName;
      } else {
        // Validate provided name
        if (regionExists(projectPath, regionName)) {
          console.log(chalk.red(`  Error: Region '${regionName}' already exists.`));
          process.exit(1);
        }
      }

      // Get zones
      let zones: string[] = [];
      if (options.zones) {
        zones = options.zones.split(",").map((z: string) => z.trim());
      } else {
        const { zoneNames } = await inquirer.prompt([
          {
            type: "input",
            name: "zoneNames",
            message: "Zones to create (comma-separated):",
            default: "main",
            validate: (input: string) => {
              if (!input) return "At least one zone required";
              const parts = input.split(",").map((z) => z.trim());
              const invalid = parts.find((z) => !/^[a-z0-9-]+$/.test(z));
              if (invalid) return `Invalid: ${invalid}`;
              return true;
            },
          },
        ]);
        zones = zoneNames.split(",").map((z: string) => z.trim());
      }

      // Hub handling
      // - Local tier: no hub
      // - First region (no existing hubs): auto-create hub-{region}
      // - Otherwise: ask user to create new or use existing
      let createHub = true;
      let assignedHub: string = `hub-${regionName}`;

      if (isLocal) {
        // No hub for local tier
        createHub = false;
        assignedHub = "";
      } else {
        const existingHubs = project.regions.flatMap((r) => r.hubs);

        if (existingHubs.length === 0) {
          // First region with hub - auto create
          console.log(chalk.gray(`  Hub: hub-${regionName} (first hub, auto-created)`));
          createHub = true;
          assignedHub = `hub-${regionName}`;
        } else {
          // Ask user: create new or use existing?
          const { hubChoice } = await inquirer.prompt([
            {
              type: "list",
              name: "hubChoice",
              message: `Hub for region ${regionName}:`,
              choices: [
                { name: `Create new hub (hub-${regionName})`, value: "new" },
                ...existingHubs.map((h) => {
                  const ownerRegion = project.regions.find(r => r.hubs.some(hub => hub.fullName === h.fullName))?.name;
                  return {
                    name: `Use ${h.fullName} (from ${ownerRegion})`,
                    value: h.fullName,
                  };
                }),
              ],
            },
          ]);

          if (hubChoice === "new") {
            createHub = true;
            assignedHub = `hub-${regionName}`;
          } else {
            createHub = false;
            assignedHub = hubChoice;
          }
        }
      }

      // SSH key generation
      let generateSsh = options.generateSshKeys || false;
      if (!options.generateSshKeys) {
        const { genSsh } = await inquirer.prompt([
          {
            type: "confirm",
            name: "genSsh",
            message: "Generate SSH keys for new datacenters?",
            default: true,
          },
        ]);
        generateSsh = genSsh;
      }

      // Summary
      console.log("");
      console.log(chalk.white("  Summary:"));
      console.log(chalk.gray(`    Region: ${regionName}`));
      console.log(chalk.gray(`    Zones: ${zones.join(", ")}`));
      if (isLocal) {
        console.log(chalk.gray(`    Hub: (none - local tier)`));
      } else if (createHub) {
        console.log(chalk.gray(`    Hub: ${assignedHub} (new)`));
      } else {
        console.log(chalk.gray(`    Hub: ${assignedHub} (existing)`));
      }
      console.log(chalk.gray(`    SSH Keys: ${generateSsh ? "Yes" : "No"}`));
      console.log("");

      // Confirm
      const { confirm } = await inquirer.prompt([
        {
          type: "confirm",
          name: "confirm",
          message: "Create this region?",
          default: true,
        },
      ]);

      if (!confirm) {
        console.log(chalk.yellow("\nAborted."));
        process.exit(0);
      }

      // Create region
      console.log("");
      console.log(chalk.white("  Creating region..."));

      const regionConfig: RegionConfig = {
        name: regionName!,
        zones,
        hub: assignedHub || undefined,
      };

      // Create generator context
      const ctx: GeneratorContext = {
        projectPath,
        options: {
          projectName: platform.project_name || path.basename(projectPath),
          domain: platform.domain || "example.com",
          regions: [
            ...project.regions.map((r) => ({ name: r.name, zones: r.zones.map((z) => z.name) })),
            regionConfig,
          ],
          primaryRegion: project.regions[0]?.name || regionName!,
          primaryZone: project.regions[0]?.zones[0]?.name || zones[0],
          generateSshKeys: generateSsh,
          infrastructureTier: tier,
          complianceLevel: "startup",
          skipHubs: isLocal,
        },
      };

      // Generate inventory files
      console.log(chalk.gray("    • inventory/"));

      // Region yaml
      generateRegionYaml({ ctx, region: regionConfig });
      console.log(chalk.gray(`      ${regionName}/region.yaml`));

      // Get datacenters to create
      const datacenters = getDatacenters(regionConfig, createHub);

      for (const dc of datacenters) {
        console.log(chalk.gray(`      ${regionName}/datacenters/${dc.fullName}/`));
        generateNodesYaml({ ctx, region: regionConfig, datacenter: dc });
        generateNetworkYaml({ ctx, region: regionConfig, datacenter: dc });
        generateSshYaml({ ctx, region: regionConfig, datacenter: dc });
      }

      // Generate workloads
      console.log(chalk.gray("    • workloads/"));

      // Regional workloads
      console.log(chalk.gray(`      regional/${regionName}/`));
      generateMonitoringYaml({ ctx, region: regionConfig });
      generateBastionYaml({ ctx, region: regionConfig });
      if (!isLocal) {
        generateSiemYaml({ ctx, region: regionConfig });
      }

      // Zonal workloads
      for (const dc of datacenters) {
        console.log(chalk.gray(`      zonal/${regionName}/${dc.fullName}/`));
        if (dc.type === "hub") {
          generateStorageYaml({ ctx, region: regionConfig, datacenter: dc });
          generateBackupYaml({ ctx, region: regionConfig, datacenter: dc });
        } else {
          generateFirewallYaml({ ctx, region: regionConfig, datacenter: dc });
          generateLoadbalancerYaml({ ctx, region: regionConfig, datacenter: dc });
        }
      }

      // Create .soverstack folders
      for (const dc of datacenters) {
        const soverstackDir = path.join(projectPath, ".soverstack", regionName!, dc.fullName);
        fs.mkdirSync(path.join(soverstackDir, "state"), { recursive: true });
        fs.mkdirSync(path.join(soverstackDir, "logs"), { recursive: true });
        fs.writeFileSync(path.join(soverstackDir, "state", ".gitkeep"), "");
        fs.writeFileSync(path.join(soverstackDir, "logs", ".gitkeep"), "");
      }

      // Generate SSH keys if requested
      if (generateSsh) {
        console.log(chalk.gray("    • .ssh/"));
        const { generateSshKeys } = await import("../init-v2/generators");
        const dcList = datacenters.map((dc) => ({ region: regionConfig, dc }));
        generateSshKeys(ctx, dcList);
      }

      console.log("");
      console.log(chalk.green(`  ✓ Region '${regionName}' created successfully!`));
      console.log("");
      console.log(chalk.white("  Next steps:"));
      console.log(
        chalk.gray(`    1. Edit inventory/${regionName}/datacenters/*/nodes.yaml - Set server IPs`),
      );
      console.log(
        chalk.gray(
          `    2. Edit inventory/${regionName}/datacenters/*/network.yaml - Configure VLANs`,
        ),
      );
      if (!generateSsh) {
        console.log(
          chalk.cyan(`    3. soverstack generate ssh --region ${regionName}`) +
            chalk.gray(" - Generate SSH keys"),
        );
      }
      console.log("");
    } catch (error) {
      console.log(chalk.red("\nFailed to add region:"));
      console.log(chalk.red((error as Error).message));
      process.exit(1);
    }
  });
