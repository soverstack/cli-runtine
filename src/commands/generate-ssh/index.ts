import { Command } from "commander";
import chalk from "chalk";
import fs from "fs";
import path from "path";

// Reuse SSH functions from init-v2
import {
  generateSshKeyPair,
  checkExistingSshKeys,
  SSH_USERS,
} from "../init-v2/generators";

/**
 * Discover all datacenters from inventory directory structure
 */
function discoverDatacenters(projectPath: string): string[] {
  const inventoryPath = path.join(projectPath, "inventory");
  const datacenters: string[] = [];

  if (!fs.existsSync(inventoryPath)) {
    return datacenters;
  }

  // Scan regions
  const regions = fs.readdirSync(inventoryPath).filter((f) => {
    const stat = fs.statSync(path.join(inventoryPath, f));
    return stat.isDirectory() && !f.startsWith(".");
  });

  for (const region of regions) {
    const dcPath = path.join(inventoryPath, region, "datacenters");
    if (!fs.existsSync(dcPath)) continue;

    // Scan datacenters
    const dcs = fs.readdirSync(dcPath).filter((f) => {
      const stat = fs.statSync(path.join(dcPath, f));
      return stat.isDirectory() && !f.startsWith(".");
    });

    datacenters.push(...dcs);
  }

  return datacenters;
}

export const generateSshKeysCommand = new Command("generate:ssh-keys")
  .description("Generate SSH keys for all datacenters in the project")
  .argument("[platform-file]", "Path to platform.yaml", "platform.yaml")
  .option("-f, --force", "Overwrite existing keys", false)
  .action(async (platformFile: string, options: { force: boolean }) => {
    console.log("");
    console.log(chalk.cyan.bold("  SSH Key Generation"));
    console.log("");

    // Resolve platform.yaml path
    const platformPath = path.resolve(process.cwd(), platformFile);

    if (!fs.existsSync(platformPath)) {
      console.log(chalk.red(`  Error: ${platformFile} not found`));
      console.log(chalk.gray(`  Run this command from your project root directory.`));
      process.exit(1);
    }

    // Get project directory (where platform.yaml is)
    const projectPath = path.dirname(platformPath);
    const sshDir = path.join(projectPath, ".ssh");

    // Discover datacenters
    const datacenters = discoverDatacenters(projectPath);

    if (datacenters.length === 0) {
      console.log(chalk.red("  Error: No datacenters found in inventory/"));
      console.log(chalk.gray("  Make sure you have run 'soverstack init-v2' first."));
      process.exit(1);
    }

    console.log(chalk.white(`  Found ${datacenters.length} datacenter(s):`));
    datacenters.forEach((dc) => {
      console.log(chalk.gray(`    - ${dc}`));
    });
    console.log("");

    // Check for existing keys (reusing function from init-v2)
    const existingKeys = checkExistingSshKeys(sshDir, datacenters);

    if (existingKeys.length > 0 && !options.force) {
      console.log(chalk.red("  Error: SSH keys already exist:"));
      existingKeys.forEach((key) => {
        console.log(chalk.gray(`    - .ssh/${key}`));
      });
      console.log("");
      console.log(chalk.yellow("  Use --force to overwrite existing keys."));
      console.log(chalk.yellow("  Warning: This will replace your current keys!"));
      process.exit(1);
    }

    // Create .ssh directory if needed
    if (!fs.existsSync(sshDir)) {
      fs.mkdirSync(sshDir, { recursive: true });
    }

    // Generate keys
    console.log(chalk.white("  Generating SSH keys...\n"));

    let generated = 0;
    let failed = 0;

    for (const dc of datacenters) {
      for (const user of SSH_USERS) {
        const keyName = `${dc}_${user.name}`;
        process.stdout.write(chalk.gray(`    ${keyName}... `));

        // Reuse function from init-v2
        if (generateSshKeyPair(sshDir, dc, user.name)) {
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
  });
