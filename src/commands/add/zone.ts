/**
 * Add Zone Command
 *
 * Add a new zone to an existing region.
 */

import { Command } from "commander";
import chalk from "chalk";
import inquirer from "inquirer";
import path from "path";
import fs from "fs";
import yaml from "js-yaml";

import {
  scanProject,
  regionExists,
  datacenterExists,
  findProjectRoot,
  getNextZoneIndex,
} from "./utils/scanner";
import { RegionConfig, DatacenterConfig, GeneratorContext } from "../init-v2/types";
import { InfrastructureTierType } from "@/types";

interface PlatformConfig {
  project_name: string;
  domain: string;
  infrastructure_tier: InfrastructureTierType;
}

// Import generators
import {
  generateNetworkYaml,
  generateNodesYaml,
  generateSshYaml,
  generateFirewallYaml,
  generateLoadbalancerYaml,
} from "../init-v2/generators";

// ════════════════════════════════════════════════════════════════════════════
// COMMAND
// ════════════════════════════════════════════════════════════════════════════

export const addZoneCommand = new Command("zone")
  .description("Add a new zone to an existing region")
  .argument("[region]", "Region name")
  .argument("[zone-name]", "Name of the zone")
  .option("--generate-ssh-keys", "Generate SSH keys for the new zone")
  .action(async (regionArg: string | undefined, zoneArg: string | undefined, options: any) => {
    try {
      console.log("");
      console.log(chalk.cyan.bold("  ADD ZONE"));
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

      if (project.regions.length === 0) {
        console.log(chalk.red("  Error: No regions found."));
        console.log(chalk.gray("  Create a region first with: soverstack add region"));
        process.exit(1);
      }

      // Read platform.yaml to get config
      const platformPath = path.join(projectPath, "platform.yaml");
      const platformContent = fs.readFileSync(platformPath, "utf-8");
      const platform = yaml.load(platformContent) as PlatformConfig;
      const tier = platform.infrastructure_tier || "production";
      const isLocal = tier === "local";
      const domain = platform.domain || "example.com";

      // Select region
      let selectedRegion = regionArg;
      if (!selectedRegion) {
        // Show regions and let user choose
        console.log(chalk.white("  Available regions:"));
        project.regions.forEach((r, i) => {
          const zoneNames = r.zones.map((z) => z.name).join(", ");
          console.log(chalk.gray(`    ${i + 1}. ${r.name} (zones: ${zoneNames || "none"})`));
        });
        console.log("");

        const { regionChoice } = await inquirer.prompt([
          {
            type: "list",
            name: "regionChoice",
            message: "Select region:",
            choices: project.regions.map((r) => ({
              name: `${r.name} (${r.zones.length} zones)`,
              value: r.name,
            })),
          },
        ]);
        selectedRegion = regionChoice;
      } else {
        // Validate provided region
        if (!regionExists(projectPath, selectedRegion)) {
          console.log(chalk.red(`  Error: Region '${selectedRegion}' does not exist.`));
          console.log(chalk.gray("  Available regions:"));
          project.regions.forEach((r) => {
            console.log(chalk.gray(`    • ${r.name}`));
          });
          process.exit(1);
        }
      }

      const region = project.regions.find((r) => r.name === selectedRegion)!;

      // Show existing zones in the region
      if (region.zones.length > 0) {
        console.log("");
        console.log(chalk.white(`  Existing zones in ${selectedRegion}:`));
        region.zones.forEach((z) => {
          console.log(chalk.gray(`    • ${z.name} (${z.fullName})`));
        });
        console.log("");
      }

      // Get zone name
      let zoneName = zoneArg;
      if (!zoneName) {
        const { inputName } = await inquirer.prompt([
          {
            type: "input",
            name: "inputName",
            message: "New zone name:",
            validate: (input: string) => {
              if (!input) return "Required";
              if (!/^[a-z0-9-]+$/.test(input)) return "Lowercase, numbers, hyphens only";
              const fullName = `zone-${input}`;
              if (datacenterExists(projectPath, selectedRegion!, fullName)) {
                return `Zone '${input}' already exists in ${selectedRegion}`;
              }
              return true;
            },
          },
        ]);
        zoneName = inputName;
      } else {
        // Validate provided zone name
        const fullName = `zone-${zoneName}`;
        if (datacenterExists(projectPath, selectedRegion!, fullName)) {
          console.log(chalk.red(`  Error: Zone '${zoneName}' already exists in ${selectedRegion}.`));
          process.exit(1);
        }
      }

      // SSH key generation
      let generateSsh = options.generateSshKeys || false;
      if (!options.generateSshKeys) {
        const { genSsh } = await inquirer.prompt([
          {
            type: "confirm",
            name: "genSsh",
            message: "Generate SSH keys for the new zone?",
            default: true,
          },
        ]);
        generateSsh = genSsh;
      }

      // Summary
      const fullZoneName = `zone-${zoneName}`;
      console.log("");
      console.log(chalk.white("  Summary:"));
      console.log(chalk.gray(`    Region: ${selectedRegion}`));
      console.log(chalk.gray(`    Zone: ${zoneName} (${fullZoneName})`));
      console.log(chalk.gray(`    SSH Keys: ${generateSsh ? "Yes" : "No"}`));
      console.log("");

      // Confirm
      const { confirm } = await inquirer.prompt([
        {
          type: "confirm",
          name: "confirm",
          message: "Create this zone?",
          default: true,
        },
      ]);

      if (!confirm) {
        console.log(chalk.yellow("\nAborted."));
        process.exit(0);
      }

      // Create zone
      console.log("");
      console.log(chalk.white("  Creating zone..."));

      // Build region config with existing zones + new one
      const existingZoneNames = region.zones.map((z) => z.name);
      const regionConfig: RegionConfig = {
        name: selectedRegion!,
        zones: [...existingZoneNames, zoneName!],
        hub: region.hubs[0]?.fullName,
      };

      const datacenterConfig: DatacenterConfig = {
        name: zoneName!,
        type: "zone",
        fullName: fullZoneName,
      };

      // Create generator context
      const ctx: GeneratorContext = {
        projectPath,
        options: {
          projectName: path.basename(projectPath),
          domain,
          regions: project.regions.map((r) => ({
            name: r.name,
            zones: r.name === selectedRegion
              ? [...r.zones.map((z) => z.name), zoneName!]
              : r.zones.map((z) => z.name),
          })),
          primaryRegion: project.regions[0]?.name || selectedRegion!,
          primaryZone: project.regions[0]?.zones[0]?.name || zoneName!,
          generateSshKeys: generateSsh,
          infrastructureTier: tier,
          complianceLevel: "startup",
          skipHubs: isLocal,
        },
      };

      // Generate inventory files
      console.log(chalk.gray("    • inventory/"));
      console.log(chalk.gray(`      ${selectedRegion}/datacenters/${fullZoneName}/`));

      generateNodesYaml({ ctx, region: regionConfig, datacenter: datacenterConfig });
      generateNetworkYaml({ ctx, region: regionConfig, datacenter: datacenterConfig });
      generateSshYaml({ ctx, region: regionConfig, datacenter: datacenterConfig });

      // Generate workloads
      console.log(chalk.gray("    • workloads/"));
      console.log(chalk.gray(`      zonal/${selectedRegion}/${fullZoneName}/`));

      generateFirewallYaml({ ctx, region: regionConfig, datacenter: datacenterConfig });
      generateLoadbalancerYaml({ ctx, region: regionConfig, datacenter: datacenterConfig });

      // Create .soverstack folders
      const soverstackDir = path.join(projectPath, ".soverstack", selectedRegion!, fullZoneName);
      fs.mkdirSync(path.join(soverstackDir, "state"), { recursive: true });
      fs.mkdirSync(path.join(soverstackDir, "logs"), { recursive: true });
      fs.writeFileSync(path.join(soverstackDir, "state", ".gitkeep"), "");
      fs.writeFileSync(path.join(soverstackDir, "logs", ".gitkeep"), "");

      // Generate SSH keys if requested
      if (generateSsh) {
        console.log(chalk.gray("    • .ssh/"));
        const { generateSshKeys } = await import("../init-v2/generators");
        const dcList = [{ region: regionConfig, dc: datacenterConfig }];
        generateSshKeys(ctx, dcList);
      }

      console.log("");
      console.log(chalk.green(`  ✓ Zone '${zoneName}' created in region '${selectedRegion}'!`));
      console.log("");
      console.log(chalk.white("  Next steps:"));
      console.log(chalk.gray(`    1. Edit inventory/${selectedRegion}/datacenters/${fullZoneName}/nodes.yaml - Set server IPs`));
      console.log(chalk.gray(`    2. Edit inventory/${selectedRegion}/datacenters/${fullZoneName}/network.yaml - Configure VLANs`));
      if (!generateSsh) {
        console.log(chalk.cyan(`    3. soverstack generate ssh --dc ${selectedRegion}:${fullZoneName}`) + chalk.gray(" - Generate SSH keys"));
      }
      console.log("");
    } catch (error) {
      console.log(chalk.red("\nFailed to add zone:"));
      console.log(chalk.red((error as Error).message));
      process.exit(1);
    }
  });
