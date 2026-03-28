/**
 * Soverstack Init V2 - Main Logic
 *
 * Orchestrates the generation of the new project structure.
 * See types.ts for structure documentation.
 */

import fs from "fs";
import path from "path";
import chalk from "chalk";
import ora from "ora";

import {
  InitOptions,
  GeneratorContext,
  RegionConfig,
  getDatacenters,
  getHubName,
} from "./types";

import {
  // Root
  generatePlatformYaml,
  generateEnvFile,
  generateReadme,
  generateGitignore,
  // Inventory
  generateSshYaml,
  generateSshKeys,
  generateRegionYaml,
  generateNetworkYaml,
  generateNodesYaml,
  // Workloads - Global
  generateDatabaseYaml,
  generateDnsYaml,
  generateSecretsYaml,
  generateIdentityYaml,
  generateMeshYaml,
  // Workloads - Regional
  generateMonitoringYaml,
  generateBastionYaml,
  generateSiemYaml,
  // Workloads - Zonal
  generateFirewallYaml,
  generateLoadbalancerYaml,
  generateStorageYaml,
  generateBackupYaml,
} from "./generators";

import { DatacenterConfig } from "./types";

export class ProjectInitializer {
  private projectPath: string;
  private options: InitOptions;
  private ctx: GeneratorContext;

  constructor(options: InitOptions) {
    this.options = options;
    this.projectPath = path.resolve(process.cwd(), options.projectName);
    this.ctx = {
      projectPath: this.projectPath,
      options,
    };
  }

  async initialize(): Promise<void> {
    console.log(chalk.blue("\nInitializing Soverstack project (v2)...\n"));

    await this.createProjectDirectory();
    await this.createDirectoryStructure();
    await this.generateRootFiles();
    await this.generateInventory();
    await this.generateWorkloads();
    await this.createSoverstackDirectory();

    console.log(chalk.green("\nProject initialized successfully!\n"));
    this.printNextSteps();
  }

  private async createProjectDirectory(): Promise<void> {
    const spinner = ora("Creating project directory").start();
    try {
      if (fs.existsSync(this.projectPath)) {
        spinner.fail(chalk.red("Directory " + this.options.projectName + " already exists"));
        process.exit(1);
      }
      fs.mkdirSync(this.projectPath, { recursive: true });
      spinner.succeed("Project directory created");
    } catch (error) {
      spinner.fail("Failed to create project directory");
      throw error;
    }
  }

  private async createDirectoryStructure(): Promise<void> {
    const spinner = ora("Creating directory structure").start();
    try {
      fs.mkdirSync(path.join(this.projectPath, "inventory"), { recursive: true });
      fs.mkdirSync(path.join(this.projectPath, "workloads", "global"), { recursive: true });
      fs.mkdirSync(path.join(this.projectPath, "workloads", "regional"), { recursive: true });
      fs.mkdirSync(path.join(this.projectPath, "workloads", "zonal"), { recursive: true });

      spinner.succeed("Directory structure created");
    } catch (error) {
      spinner.fail("Failed to create directory structure");
      throw error;
    }
  }

  private async createSoverstackDirectory(): Promise<void> {
    const spinner = ora("Creating .soverstack directory").start();
    try {
      const soverstackPath = path.join(this.projectPath, ".soverstack");
      const includeHub = !this.options.skipHubs;

      this.options.regions.forEach((region: RegionConfig) => {
        const datacenters = getDatacenters(region, includeHub);

        datacenters.forEach((dc) => {
          const dcPath = path.join(soverstackPath, region.name, dc.fullName);
          fs.mkdirSync(path.join(dcPath, "state"), { recursive: true });
          fs.mkdirSync(path.join(dcPath, "logs"), { recursive: true });
          fs.writeFileSync(path.join(dcPath, "state", ".gitkeep"), "");
          fs.writeFileSync(path.join(dcPath, "logs", ".gitkeep"), "");
        });
      });

      fs.mkdirSync(path.join(soverstackPath, "cache"), { recursive: true });
      fs.writeFileSync(path.join(soverstackPath, "cache", ".gitkeep"), "");

      spinner.succeed(".soverstack directory created");
    } catch (error) {
      spinner.fail("Failed to create .soverstack directory");
      throw error;
    }
  }

  private async generateRootFiles(): Promise<void> {
    const spinner = ora("Generating root files").start();
    try {
      generatePlatformYaml(this.ctx);
      generateEnvFile(this.ctx);
      generateReadme(this.ctx);
      generateGitignore(this.ctx);

      spinner.succeed("Root files generated");
    } catch (error) {
      spinner.fail("Failed to generate root files");
      throw error;
    }
  }

  private async generateInventory(): Promise<void> {
    const spinner = ora("Generating inventory files").start();
    try {
      const includeHub = !this.options.skipHubs;

      // Collect all datacenters for SSH key generation
      const allDatacenters: { region: RegionConfig; dc: DatacenterConfig }[] = [];

      this.options.regions.forEach((region: RegionConfig) => {
        generateRegionYaml({ ctx: this.ctx, region });

        const datacenters = getDatacenters(region, includeHub);
        datacenters.forEach((dc) => {
          allDatacenters.push({ region, dc });
          generateNetworkYaml({ ctx: this.ctx, region, datacenter: dc });
          generateNodesYaml({ ctx: this.ctx, region, datacenter: dc });
          generateSshYaml({ ctx: this.ctx, region, datacenter: dc });
        });
      });

      // Generate SSH keys in .ssh/ directory
      generateSshKeys(this.ctx, allDatacenters);

      spinner.succeed("Inventory files generated");
    } catch (error) {
      spinner.fail("Failed to generate inventory files");
      throw error;
    }
  }

  private async generateWorkloads(): Promise<void> {
    const spinner = ora("Generating workload files").start();
    try {
      // Global workloads (only once)
      generateDatabaseYaml(this.ctx);
      generateDnsYaml(this.ctx);
      generateSecretsYaml(this.ctx);
      generateIdentityYaml(this.ctx);
      generateMeshYaml(this.ctx);

      const includeHub = !this.options.skipHubs;

      // Regional and Zonal workloads (per region)
      this.options.regions.forEach((region: RegionConfig) => {
        // Regional workloads
        generateMonitoringYaml({ ctx: this.ctx, region });
        generateBastionYaml({ ctx: this.ctx, region });
        generateSiemYaml({ ctx: this.ctx, region });

        // Zonal workloads
        const datacenters = getDatacenters(region, includeHub);
        datacenters.forEach((dc) => {
          if (dc.type === "hub") {
            // Hub: storage + backup
            generateStorageYaml({ ctx: this.ctx, region, datacenter: dc });
            generateBackupYaml({ ctx: this.ctx, region, datacenter: dc });
          } else {
            // Zone: firewall + loadbalancer
            generateFirewallYaml({ ctx: this.ctx, region, datacenter: dc });
            generateLoadbalancerYaml({ ctx: this.ctx, region, datacenter: dc });
          }
        });
      });

      spinner.succeed("Workload files generated");
    } catch (error) {
      spinner.fail("Failed to generate workload files");
      throw error;
    }
  }

  private printNextSteps(): void {
    const { primaryRegion, primaryZone, skipHubs, generateSshKeys: keysGenerated } = this.options;

    console.log(chalk.bold("Quick Start:\n"));
    console.log(chalk.white("  1. ") + chalk.cyan("cd " + this.options.projectName));
    if (!keysGenerated) {
      console.log(chalk.white("  2. ") + chalk.cyan("soverstack generate:ssh-keys platform.yaml"));
    }
    console.log(chalk.white(keysGenerated ? "  2. " : "  3. ") + "Edit " + chalk.cyan(".env") + " - Set bootstrap passwords");
    console.log(
      chalk.white(keysGenerated ? "  3. " : "  4. ") +
        "Edit " +
        chalk.cyan("inventory/" + primaryRegion + "/datacenters/zone-" + primaryZone + "/nodes.yaml") +
        " - Set node IPs"
    );
    console.log(chalk.white(keysGenerated ? "  4. " : "  5. ") + chalk.cyan("soverstack bootstrap") + " - Setup SSH access");
    console.log(chalk.white(keysGenerated ? "  5. " : "  6. ") + chalk.cyan("soverstack install proxmox"));
    console.log(chalk.white(keysGenerated ? "  6. " : "  7. ") + chalk.cyan("soverstack apply"));

    console.log(chalk.bold("\nProject Structure:\n"));
    console.log(chalk.gray("  platform.yaml         ") + "Global config (images, flavors)");
    console.log(chalk.gray("  .env                  ") + "All secrets (NEVER COMMIT)");
    console.log(chalk.gray("  .ssh/                 ") + "SSH keys (NEVER COMMIT)");
    console.log(chalk.gray("  inventory/            ") + "Physical infrastructure");
    console.log(chalk.gray("  workloads/            ") + "Services to deploy");

    console.log(chalk.bold("\nDatacenters:\n"));
    this.options.regions.forEach((region: RegionConfig) => {
      const hubName = getHubName(region);
      const isControlPlaneRegion = region.name === primaryRegion;

      console.log(chalk.white("  " + region.name + "/"));

      if (!skipHubs) {
        console.log(chalk.gray("    " + hubName) + chalk.dim(" (backup/storage)"));
      }

      region.zones.forEach((zone) => {
        const isControlPlane = isControlPlaneRegion && zone === primaryZone;
        console.log(
          chalk.gray("    zone-" + zone) +
            (isControlPlane ? chalk.cyan(" (control plane)") : "")
        );
      });
    });

    if (skipHubs) {
      console.log(chalk.yellow("\n  Note: Hubs disabled (local tier)"));
    }

    console.log(chalk.yellow("\nNever commit: .env, .ssh/, .soverstack/state/"));
  }
}
