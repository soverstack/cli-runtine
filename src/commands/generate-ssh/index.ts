/**
 * Generate SSH Keys Command
 *
 * Generate SSH keys for datacenters with interactive selection.
 *
 * Usage:
 *   soverstack generate ssh                     # Interactive
 *   soverstack generate ssh --all               # All datacenters
 *   soverstack generate ssh --region eu         # All DCs in region
 *   soverstack generate ssh --dc eu:zone-paris  # Specific DC
 *   soverstack generate ssh --force             # Overwrite existing
 */

import { Command } from "commander";
import chalk from "chalk";
import inquirer from "inquirer";
import fs from "fs";
import path from "path";

import {
  scanProject,
  findProjectRoot,
  ScannedDatacenter,
  ScannedRegion,
} from "../add/utils/scanner";

import {
  generateSshKeyPair,
  checkExistingSshKeys,
  SSH_USERS,
} from "../init-v2/generators";

// ════════════════════════════════════════════════════════════════════════════
// COMMAND
// ════════════════════════════════════════════════════════════════════════════

export const generateSshCommand = new Command("ssh")
  .description("Generate SSH keys for datacenters")
  .option("--all", "Generate for all datacenters")
  .option("--region <region>", "Generate for all datacenters in a region")
  .option("--dc <region:dc>", "Generate for a specific datacenter (format: region:datacenter)")
  .option("-f, --force", "Overwrite existing keys", false)
  .action(async (options: { all?: boolean; region?: string; dc?: string; force: boolean }) => {
    try {
      console.log("");
      console.log(chalk.cyan.bold("  SSH KEY GENERATION"));
      console.log("");

      // Find project root
      const projectPath = findProjectRoot();
      if (!projectPath) {
        console.log(chalk.red("  Error: No platform.yaml found."));
        console.log(chalk.gray("  Run this command from your project directory."));
        process.exit(1);
      }

      // Scan project
      const project = scanProject(projectPath);

      if (project.regions.length === 0) {
        console.log(chalk.red("  Error: No regions found in inventory/."));
        console.log(chalk.gray("  Run 'soverstack init-v2' first."));
        process.exit(1);
      }

      const sshDir = path.join(projectPath, ".ssh");

      // Determine which datacenters to generate for
      let targetDatacenters: { region: string; dc: ScannedDatacenter }[] = [];

      if (options.all) {
        // All datacenters
        for (const region of project.regions) {
          for (const dc of region.datacenters) {
            targetDatacenters.push({ region: region.name, dc });
          }
        }
      } else if (options.region) {
        // All datacenters in a region
        const region = project.regions.find((r) => r.name === options.region);
        if (!region) {
          console.log(chalk.red(`  Error: Region '${options.region}' not found.`));
          console.log(chalk.gray("  Available regions:"));
          project.regions.forEach((r) => {
            console.log(chalk.gray(`    • ${r.name}`));
          });
          process.exit(1);
        }
        for (const dc of region.datacenters) {
          targetDatacenters.push({ region: region.name, dc });
        }
      } else if (options.dc) {
        // Specific datacenter
        const [regionName, dcName] = options.dc.split(":");
        if (!regionName || !dcName) {
          console.log(chalk.red("  Error: Invalid format. Use --dc region:datacenter"));
          console.log(chalk.gray("  Example: --dc eu:zone-paris"));
          process.exit(1);
        }
        const region = project.regions.find((r) => r.name === regionName);
        if (!region) {
          console.log(chalk.red(`  Error: Region '${regionName}' not found.`));
          process.exit(1);
        }
        const dc = region.datacenters.find((d) => d.fullName === dcName);
        if (!dc) {
          console.log(chalk.red(`  Error: Datacenter '${dcName}' not found in region '${regionName}'.`));
          console.log(chalk.gray("  Available datacenters:"));
          region.datacenters.forEach((d) => {
            console.log(chalk.gray(`    • ${d.fullName}`));
          });
          process.exit(1);
        }
        targetDatacenters.push({ region: regionName, dc });
      } else {
        // Interactive mode
        targetDatacenters = await selectDatacentersInteractively(project.regions);
      }

      if (targetDatacenters.length === 0) {
        console.log(chalk.yellow("  No datacenters selected."));
        process.exit(0);
      }

      // Show what will be generated
      console.log(chalk.white(`  Generating SSH keys for ${targetDatacenters.length} datacenter(s):`));
      targetDatacenters.forEach(({ region, dc }) => {
        console.log(chalk.gray(`    • ${region}/${dc.fullName}`));
      });
      console.log("");

      // Check for existing keys
      const dcNames = targetDatacenters.map(({ dc }) => dc.fullName);
      const existingKeys = checkExistingSshKeys(sshDir, dcNames);

      if (existingKeys.length > 0 && !options.force) {
        console.log(chalk.yellow("  Some keys already exist:"));
        existingKeys.forEach((key) => {
          console.log(chalk.gray(`    - .ssh/${key}`));
        });
        console.log("");

        const { overwrite } = await inquirer.prompt([
          {
            type: "confirm",
            name: "overwrite",
            message: "Overwrite existing keys?",
            default: false,
          },
        ]);

        if (!overwrite) {
          console.log(chalk.yellow("\nAborted."));
          process.exit(0);
        }
      }

      // Create .ssh directory if needed
      if (!fs.existsSync(sshDir)) {
        fs.mkdirSync(sshDir, { recursive: true });
      }

      // Generate keys
      console.log(chalk.white("  Generating keys..."));
      console.log("");

      let generated = 0;
      let failed = 0;

      for (const { dc } of targetDatacenters) {
        for (const user of SSH_USERS) {
          const keyName = `${dc.fullName}_${user.name}`;
          process.stdout.write(chalk.gray(`    ${keyName}... `));

          if (generateSshKeyPair(sshDir, dc.fullName, user.name)) {
            console.log(chalk.green("✓"));
            generated++;
          } else {
            console.log(chalk.red("✗"));
            failed++;
          }
        }
      }

      console.log("");

      if (failed > 0) {
        console.log(chalk.yellow(`  Generated ${generated} keys, ${failed} failed.`));
        console.log(chalk.gray("  Make sure ssh-keygen is installed and accessible."));
      } else {
        console.log(chalk.green(`  ✓ Generated ${generated} SSH keys in .ssh/`));
      }

      console.log("");
      console.log(chalk.white("  Next steps:"));
      console.log(chalk.gray("    1. Edit .env - Set bootstrap passwords from your provider"));
      console.log(chalk.gray("    2. Edit inventory/.../nodes.yaml - Set actual node IPs"));
      console.log(chalk.cyan("    3. soverstack bootstrap") + chalk.gray(" - Deploy keys to servers"));
      console.log("");
    } catch (error) {
      console.log(chalk.red("\nFailed to generate SSH keys:"));
      console.log(chalk.red((error as Error).message));
      process.exit(1);
    }
  });

// ════════════════════════════════════════════════════════════════════════════
// INTERACTIVE SELECTION
// ════════════════════════════════════════════════════════════════════════════

async function selectDatacentersInteractively(
  regions: ScannedRegion[]
): Promise<{ region: string; dc: ScannedDatacenter }[]> {
  // Count total datacenters
  const totalDcs = regions.reduce((sum, r) => sum + r.datacenters.length, 0);

  // Ask for scope
  const { scope } = await inquirer.prompt([
    {
      type: "list",
      name: "scope",
      message: "Generate SSH keys for:",
      choices: [
        { name: `All datacenters (${totalDcs} DCs)`, value: "all" },
        { name: "A specific region", value: "region" },
        { name: "A specific datacenter", value: "dc" },
      ],
    },
  ]);

  const result: { region: string; dc: ScannedDatacenter }[] = [];

  if (scope === "all") {
    // All datacenters
    for (const region of regions) {
      for (const dc of region.datacenters) {
        result.push({ region: region.name, dc });
      }
    }
  } else if (scope === "region") {
    // Select region
    const { selectedRegion } = await inquirer.prompt([
      {
        type: "list",
        name: "selectedRegion",
        message: "Select region:",
        choices: regions.map((r) => ({
          name: `${r.name} (${r.datacenters.length} DCs: ${r.datacenters.map((d) => d.fullName).join(", ")})`,
          value: r.name,
        })),
      },
    ]);

    const region = regions.find((r) => r.name === selectedRegion)!;
    for (const dc of region.datacenters) {
      result.push({ region: region.name, dc });
    }
  } else {
    // Select specific datacenter
    const { selectedRegion } = await inquirer.prompt([
      {
        type: "list",
        name: "selectedRegion",
        message: "Select region:",
        choices: regions.map((r) => ({
          name: r.name,
          value: r.name,
        })),
      },
    ]);

    const region = regions.find((r) => r.name === selectedRegion)!;

    const { selectedDc } = await inquirer.prompt([
      {
        type: "list",
        name: "selectedDc",
        message: "Select datacenter:",
        choices: region.datacenters.map((dc) => ({
          name: dc.fullName,
          value: dc.fullName,
        })),
      },
    ]);

    const dc = region.datacenters.find((d) => d.fullName === selectedDc)!;
    result.push({ region: region.name, dc });
  }

  return result;
}

// Keep old command name for backward compatibility
export const generateSshKeysCommand = new Command("generate:ssh-keys")
  .description("Generate SSH keys (deprecated, use 'generate ssh')")
  .argument("[platform-file]", "Path to platform.yaml", "platform.yaml")
  .option("-f, --force", "Overwrite existing keys", false)
  .action(async () => {
    console.log(chalk.yellow("\n  Note: 'generate:ssh-keys' is deprecated."));
    console.log(chalk.yellow("  Use 'soverstack generate ssh' instead.\n"));
    // Forward to new command with --all
    await generateSshCommand.parseAsync(["--all"], { from: "user" });
  });
