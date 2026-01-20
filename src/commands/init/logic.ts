import fs from "fs";
import path from "path";
import chalk from "chalk";
import ora from "ora";

import {
  createK8sFile,
  createCoreComputeFile,
  createDatacenterFile,
  createCoreDatabaseFile,
  createNetworkingFile,
  createSecurityFile,
  createObservabilityFile,
  createAppsFile,
  createOrchestratorFile,
  createReadme,
  createGitignore,
  InitOptions,
  generatePlatformYaml,
  generateSshKeys,
  createSSHConfig,
  createEnv,
  createEnvForDatacenter,
} from "./utils";

/**
 * ProjectInitializer - Supports 2 initialization modes:
 *
 * MODE 1: SINGLE DC (default)
 *   project/
 *   ├── platform.yaml
 *   ├── datacenter.yaml
 *   ├── networking.yaml
 *   ├── security.yaml
 *   ├── observability.yaml
 *   ├── ssh_config.yaml
 *   ├── .env
 *   ├── compute/
 *   │   └── core-compute.yaml
 *   ├── database/
 *   │   └── core-database.yaml
 *   └── .soverstack/
 *       ├── state/
 *       ├── logs/
 *       └── cache/
 *
 * MODE 2: MULTI-DC (--dc paris,frankfurt)
 *   project/
 *   ├── platform.yaml           # References all DCs
 *   ├── .env                    # Global env vars
 *   └── datacenters/
 *       ├── paris/
 *       │   ├── datacenter.yaml
 *       │   ├── networking.yaml
 *       │   ├── security.yaml
 *       │   ├── observability.yaml
 *       │   ├── ssh_config.yaml
 *       │   ├── .env
 *       │   ├── compute/
 *       │   │   └── core-compute.yaml
 *       │   └── database/
 *       │       └── core-database.yaml
 *       └── frankfurt/
 *           └── ... (same structure)
 */
export class ProjectInitializer {
  private projectPath: string;
  private options: InitOptions;

  constructor(options: InitOptions) {
    this.options = options;
    this.projectPath = path.resolve(process.cwd(), options.projectName);
  }

  /**
   * Check if multiple datacenters are configured
   */
  private isMultiDc(): boolean {
    return isMultiDcFunc(this.options.datacenters);
  }

  async initialize(): Promise<void> {
    console.log(chalk.blue("Initializing Soverstack project...\n"));
    await this.createProjectDirectory();
    await this.createDirectoryStructure();
    await this.generateLayerFiles();
    await this.createSoverstackDirectory();
    if (this.options.generateSshKeys) {
      await generateSshKeys(this.projectPath);
    }
    createGitignore(this.options);
    await createReadme(this.options);
    console.log(chalk.green("\nProject initialized successfully!\n"));
    this.printNextSteps();
  }

  private async createProjectDirectory(): Promise<void> {
    const spinner = ora("Creating project directory").start();
    try {
      if (fs.existsSync(this.projectPath)) {
        spinner.fail(chalk.red(`Directory ${this.options.projectName} already exists`));
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
      if (this.isMultiDc()) {
        this.createMultiDcDirectories();
      } else {
        this.createSingleDcDirectories();
      }
      spinner.succeed("Directory structure created");
    } catch (error) {
      spinner.fail("Failed to create directory structure");
      throw error;
    }
  }

  /**
   * MODE 1: Single DC - files at root
   */
  private createSingleDcDirectories(): void {
    fs.mkdirSync(path.join(this.projectPath, "compute"), { recursive: true });
    fs.mkdirSync(path.join(this.projectPath, "database"), { recursive: true });
  }

  /**
   * MODE 2: Multi-DC
   */
  private createMultiDcDirectories(): void {
    const dirs = this.options.datacenters!.flatMap((dc) => [
      `datacenters/${dc}`,
      `datacenters/${dc}/compute`,
      `datacenters/${dc}/database`,
    ]);
    dirs.forEach((dir) => {
      fs.mkdirSync(path.join(this.projectPath, dir), { recursive: true });
    });
  }

  private async generateLayerFiles(): Promise<void> {
    const spinner = ora("Generating configuration files").start();
    try {
      if (this.isMultiDc()) {
        this.generateMultiDcFiles();
      } else {
        this.generateSingleDcFiles();
      }
      spinner.succeed("Configuration files generated");
    } catch (error) {
      spinner.fail("Failed to generate configuration files");
      throw error;
    }
  }

  /**
   * MODE 1: Single DC - all files at root
   */
  private generateSingleDcFiles(): void {
    const opts = { ...this.options, outputDir: this.projectPath };
    const computeDir = path.join(this.projectPath, "compute");
    const databaseDir = path.join(this.projectPath, "database");

    // Root level files
    generatePlatformYaml(opts);
    createOrchestratorFile(opts);
    createDatacenterFile(opts);
    createNetworkingFile(opts);
    createSecurityFile(opts);
    createObservabilityFile(opts);
    createSSHConfig(opts);
    createEnv(opts);

    // Compute files
    createCoreComputeFile({ ...opts, outputDir: computeDir });

    // Database files
    createCoreDatabaseFile({ ...opts, outputDir: databaseDir });
  }

  /**
   * MODE 2: Multi-DC
   * - platform.yaml at root (references datacenters)
   * - orchestrator.yaml at root (orchestrator is on primary DC only)
   * - .env at root (global)
   * - datacenters/<dc>/ each with full layer files
   */
  private generateMultiDcFiles(): void {
    // Root level platform.yaml, orchestrator.yaml and global .env
    const rootOpts = { ...this.options, outputDir: this.projectPath };
    generatePlatformYaml(rootOpts);
    createOrchestratorFile(rootOpts);
    createEnv(rootOpts);

    // Per-datacenter files
    this.options.datacenters!.forEach((dc) => {
      const dcDir = path.join(this.projectPath, "datacenters", dc);
      const computeDir = path.join(dcDir, "compute");
      const databaseDir = path.join(dcDir, "database");
      const dcOpts = { ...this.options, outputDir: dcDir, currentDc: dc };

      // Datacenter-specific files
      createDatacenterFile(dcOpts);
      createNetworkingFile(dcOpts);
      createSecurityFile(dcOpts);
      createObservabilityFile(dcOpts);
      createSSHConfig(dcOpts);
      createEnvForDatacenter(dcDir, dc);

      // Compute files
      createCoreComputeFile({ ...dcOpts, outputDir: computeDir });

      // Database files
      createCoreDatabaseFile({ ...dcOpts, outputDir: databaseDir });
    });
  }

  /**
   * Create .env file for a specific datacenter
   */

  private async createSoverstackDirectory(): Promise<void> {
    const spinner = ora("Creating .soverstack directory").start();
    try {
      const soverstackPath = path.join(this.projectPath, ".soverstack");

      if (this.isMultiDc()) {
        // Multi-DC: .soverstack/<dc>/state/, logs/
        this.options.datacenters!.forEach((dc) => {
          fs.mkdirSync(path.join(soverstackPath, dc, "state"), { recursive: true });
          fs.mkdirSync(path.join(soverstackPath, dc, "logs"), { recursive: true });
          fs.writeFileSync(path.join(soverstackPath, dc, "state", ".gitkeep"), "");
          fs.writeFileSync(path.join(soverstackPath, dc, "logs", ".gitkeep"), "");
        });
      } else {
        // Single DC: .soverstack/state/, logs/
        fs.mkdirSync(path.join(soverstackPath, "state"), { recursive: true });
        fs.mkdirSync(path.join(soverstackPath, "logs"), { recursive: true });
        fs.writeFileSync(path.join(soverstackPath, "state", ".gitkeep"), "");
        fs.writeFileSync(path.join(soverstackPath, "logs", ".gitkeep"), "");
      }

      // Cache directory is always at root
      fs.mkdirSync(path.join(soverstackPath, "cache"), { recursive: true });
      fs.writeFileSync(path.join(soverstackPath, "cache", ".gitkeep"), "");

      spinner.succeed(".soverstack directory created");
    } catch (error) {
      spinner.fail("Failed to create .soverstack directory");
      throw error;
    }
  }

  private printNextSteps(): void {
    console.log(chalk.bold("\nNext Steps:\n"));
    console.log(chalk.gray("1.") + " " + chalk.cyan(`cd ${this.options.projectName}`));

    if (this.isMultiDc()) {
      this.printNextStepsMultiDc();
    } else {
      this.printNextStepsSingleDc();
    }

    console.log(chalk.yellow("\nNever commit: SSH keys, .env files"));
  }

  private printNextStepsSingleDc(): void {
    console.log(chalk.gray("2.") + " Configure infrastructure:");
    console.log(chalk.gray("   - platform.yaml"));
    console.log(chalk.gray("   - datacenter.yaml"));
    console.log(chalk.gray("   - compute/core-compute.yaml"));
    console.log(chalk.gray("   - database/core-database.yaml"));
    console.log(chalk.gray("   - networking.yaml"));
    console.log(chalk.gray("   - security.yaml"));
    console.log(chalk.gray("   - observability.yaml"));
    console.log(chalk.gray("   - ssh_config.yaml"));
    console.log(chalk.gray("\n3.") + " Set .env variables");
    console.log(chalk.gray("4.") + " Validate: " + chalk.cyan("soverstack validate platform.yaml"));
    console.log(chalk.gray("5.") + " Apply: " + chalk.cyan("soverstack apply platform.yaml"));
  }

  private printNextStepsMultiDc(): void {
    console.log(chalk.gray("2.") + " Configure datacenters:");

    this.options.datacenters!.forEach((dc) => {
      console.log(chalk.gray(`   datacenters/${dc}/`));
      console.log(chalk.gray("     - datacenter.yaml"));
      console.log(chalk.gray("     - compute/core-compute.yaml"));
      console.log(chalk.gray("     - database/core-database.yaml"));
      console.log(chalk.gray("     - networking.yaml"));
      console.log(chalk.gray("     - security.yaml"));
      console.log(chalk.gray("     - observability.yaml"));
      console.log(chalk.gray("     - ssh_config.yaml"));
      console.log(chalk.gray("     - .env"));
    });

    console.log(chalk.gray("\n3.") + " Set .env variables (root + per datacenter)");

    this.options.datacenters!.forEach((dc, i) => {
      const step = 4 + i * 2;
      console.log(
        chalk.gray(`${step}.`) +
          " Validate: " +
          chalk.cyan(`soverstack validate platform.yaml --dc ${dc}`)
      );
      console.log(
        chalk.gray(`${step + 1}.`) +
          " Apply: " +
          chalk.cyan(`soverstack apply platform.yaml --dc ${dc}`)
      );
    });
  }
}


export const isMultiDcFunc=(datacenters?:string[] )=>{
 return !!( datacenters &&  datacenters.length > 0);
}