import fs from "fs";
import path from "path";
import chalk from "chalk";
import ora from "ora";

import {
  createCoreComputeFile,
  createCoreDatabaseFile,
  createNetworkingFile,
  createSecurityFile,
  createObservabilityFile,
  createOrchestratorFile,
  createRegionFile,
  createRegionalSecurityFile,
  createReadme,
  createGitignore,
  createAppsReadme,
  InitOptions,
  RegionConfig,
  generatePlatformYaml,
  generateSshKeys,
  createEnv,
  getPrimaryRegion,
  getPrimaryZone,
} from "./utils";

/**
 * ProjectInitializer - New Structure
 *
 * project/
 * ├── platform.yaml              # Root config (START HERE)
 * ├── .env                       # Secrets (NEVER COMMIT)
 * │
 * ├── services/                  # Global services config
 * │   ├── orchestrator.yaml      # Soverstack, PDM
 * │   ├── security.yaml          # Vault, Keycloak
 * │   ├── networking.yaml        # DNS, VPN
 * │   └── observability.yaml     # Grafana, Uptime Kuma
 * │
 * ├── compute.yaml               # Global VMs specs
 * ├── database.yaml              # PostgreSQL config
 * │
 * ├── apps/                      # Optional: app-specific config
 * │   └── README.md              # How to customize apps
 * │
 * └── regions/
 *     └── {region}/
 *         ├── region.yaml
 *         ├── security.yaml          # Teleport, Wazuh
 *         ├── observability.yaml     # Prometheus, Loki
 *         ├── compute.yaml           # Regional VMs
 *         │
 *         ├── hub/                   # Backup (optional)
 *         │   ├── datacenter.yaml
 *         │   ├── networking.yaml
 *         │   └── compute.yaml
 *         │
 *         └── zones/{zone}/          # Production
 *             ├── datacenter.yaml
 *             ├── networking.yaml
 *             └── compute.yaml
 */
export class ProjectInitializer {
  private projectPath: string;
  private options: InitOptions;

  constructor(options: InitOptions) {
    this.options = options;
    this.projectPath = path.resolve(process.cwd(), options.projectName);
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
      // Create services directory (global services config)
      fs.mkdirSync(path.join(this.projectPath, "services"), { recursive: true });

      // Create apps directory (optional customization)
      fs.mkdirSync(path.join(this.projectPath, "apps"), { recursive: true });

      // Create regions directory
      fs.mkdirSync(path.join(this.projectPath, "regions"), { recursive: true });

      spinner.succeed("Directory structure created");
    } catch (error) {
      spinner.fail("Failed to create directory structure");
      throw error;
    }
  }

  private async generateLayerFiles(): Promise<void> {
    const spinner = ora("Generating configuration files").start();
    try {
      const rootOpts = { ...this.options, outputDir: this.projectPath };
      const primaryZone = getPrimaryZone(this.options);

      // ═══════════════════════════════════════════════════════════════════
      // ROOT LEVEL FILES
      // ═══════════════════════════════════════════════════════════════════

      // platform.yaml (entry point)
      generatePlatformYaml(rootOpts);

      // .env (secrets)
      createEnv(rootOpts);

      // ═══════════════════════════════════════════════════════════════════
      // SERVICES/ (Global service configs)
      // ═══════════════════════════════════════════════════════════════════
      const servicesDir = path.join(this.projectPath, "services");

      createOrchestratorFile({ ...rootOpts, outputDir: servicesDir, currentZone: primaryZone });
      createSecurityFile({ ...rootOpts, outputDir: servicesDir });
      createObservabilityFile({ ...rootOpts, outputDir: servicesDir });
      createNetworkingFile({ ...rootOpts, outputDir: servicesDir });

      // ═══════════════════════════════════════════════════════════════════
      // COMPUTE & DATABASE (Global VMs and DB)
      // ═══════════════════════════════════════════════════════════════════
      createCoreComputeFile({ ...rootOpts, currentZone: primaryZone });
      createCoreDatabaseFile({ ...rootOpts, currentZone: primaryZone });

      // ═══════════════════════════════════════════════════════════════════
      // APPS/ (Optional customization)
      // ═══════════════════════════════════════════════════════════════════
      createAppsReadme(rootOpts);

      // ═══════════════════════════════════════════════════════════════════
      // REGIONS (regions/{region}/...)
      // ═══════════════════════════════════════════════════════════════════
      const regionsDir = path.join(this.projectPath, "regions");
      const regions = this.options.regions || [{ name: "eu", zones: ["main"] }];

      regions.forEach((regionConfig: RegionConfig) => {
        createRegionFile({
          ...rootOpts,
          regionDir: regionsDir,
          regionConfig,
        });

        // Regional security (Teleport, Wazuh - GDPR compliant)
        createRegionalSecurityFile({
          projectName: this.options.projectName,
          infrastructureTier: this.options.infrastructureTier || "production",
          regionDir: regionsDir,
          regionConfig,
        });
      });

      spinner.succeed("Configuration files generated");
    } catch (error) {
      spinner.fail("Failed to generate configuration files");
      throw error;
    }
  }

  private async createSoverstackDirectory(): Promise<void> {
    const spinner = ora("Creating .soverstack directory").start();
    try {
      const soverstackPath = path.join(this.projectPath, ".soverstack");
      const regions = this.options.regions || [{ name: "eu", zones: ["main"] }];

      // Create state directories per region/zone
      regions.forEach((region: RegionConfig) => {
        // Hub state
        fs.mkdirSync(path.join(soverstackPath, region.name, "hub", "state"), { recursive: true });
        fs.mkdirSync(path.join(soverstackPath, region.name, "hub", "logs"), { recursive: true });
        fs.writeFileSync(path.join(soverstackPath, region.name, "hub", "state", ".gitkeep"), "");
        fs.writeFileSync(path.join(soverstackPath, region.name, "hub", "logs", ".gitkeep"), "");

        // Zone state
        region.zones.forEach((zone: string) => {
          fs.mkdirSync(path.join(soverstackPath, region.name, zone, "state"), { recursive: true });
          fs.mkdirSync(path.join(soverstackPath, region.name, zone, "logs"), { recursive: true });
          fs.writeFileSync(path.join(soverstackPath, region.name, zone, "state", ".gitkeep"), "");
          fs.writeFileSync(path.join(soverstackPath, region.name, zone, "logs", ".gitkeep"), "");
        });
      });

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
    const regions = this.options.regions || [{ name: "eu", zones: ["main"] }];
    const primaryRegion = getPrimaryRegion(this.options);
    const primaryZone = getPrimaryZone(this.options);

    console.log(chalk.bold("Quick Start:\n"));
    console.log(chalk.white("  1. ") + chalk.cyan(`cd ${this.options.projectName}`));
    console.log(chalk.white("  2. ") + "Edit " + chalk.cyan(".env") + " → Fill in passwords");
    console.log(chalk.white("  3. ") + "Edit " + chalk.cyan(`regions/${primaryRegion.name}/zones/${primaryZone}/networking.yaml`) + " → Add public IPs");
    console.log(chalk.white("  4. ") + chalk.cyan("soverstack validate platform.yaml"));
    console.log(chalk.white("  5. ") + chalk.cyan("soverstack apply platform.yaml"));

    console.log(chalk.bold("\nProject Structure:\n"));
    console.log(chalk.gray("  platform.yaml         ") + "← Start here");
    console.log(chalk.gray("  .env                  ") + "← Passwords (NEVER COMMIT)");
    console.log(chalk.gray("  services/             ") + "← Global services config");
    console.log(chalk.gray("  compute.yaml          ") + "← VM specifications");
    console.log(chalk.gray("  database.yaml         ") + "← PostgreSQL config");
    console.log(chalk.gray("  apps/                 ") + "← Optional: customize apps");

    regions.forEach((region: RegionConfig) => {
      console.log(chalk.gray(`  regions/${region.name}/`));
      region.zones.forEach((zone: string) => {
        const isControlPlane = region.name === primaryRegion.name && zone === primaryZone;
        console.log(
          chalk.gray(`    └─ zones/${zone}/`) +
            (isControlPlane ? chalk.cyan(" ← control plane") : "")
        );
      });
    });

    console.log(chalk.yellow("\nNever commit: .env, SSH keys"));
  }
}
