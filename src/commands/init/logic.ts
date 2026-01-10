import fs from "fs";
import path from "path";
import chalk from "chalk";
import ora from "ora";
import { generateKeyPairSync, createPublicKey } from "crypto";

import {
  createBastionFile,
  createFirewallFile,
  createFeatureFile,
  createClusterFile,
  createComputeFile,
  createDatacenterFile,
  createReadme,
  createSimpleLayerFile,
  createGitignore,
  InitOptions,
  generatePlatformYaml,
  generateSshKeys,
  createSSHConfig,
  createEnv,
  createObservabilityFile,
  createIAMFile,
} from "./utils";

export class ProjectInitializer {
  private projectPath: string;
  private options: InitOptions;

  constructor(options: InitOptions) {
    this.options = options;
    this.projectPath = path.resolve(process.cwd(), options.projectName);
  }

  async initialize(): Promise<void> {
    console.log(chalk.blue("🚀 Initializing Soverstack project...\n"));

    // Step 1: Create project directory
    await this.createProjectDirectory();

    // Step 2: Create directory structure
    await this.createDirectoryStructure();

    // Step 3: Generate layer files
    await this.generateLayerFiles();

    // Step 4: Generate platform.yaml
    await generatePlatformYaml(this.options);

    // Step 5: Create .soverstack directory
    await this.createSoverstackDirectory();

    // Step 6: Generate SSH keys if requested
    if (this.options.generateSshKeys) {
      await generateSshKeys(this.projectPath);
    }

    // Step 7: Create .gitignore
    createGitignore(this.options);

    // Step 8: Create README
    await createReadme(this.options);

    console.log(chalk.green("\n✅ Project initialized successfully!\n"));
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
      const dirs =
        this.options.mode === "advanced"
          ? [
              "layers/datacenters",
              "layers/computes",
              "layers/clusters",
              "layers/features",
              "layers/firewalls",
              "layers/bastions",
              "layers/iam",
              "layers/observability",
              "ssh",
            ]
          : ["ssh", "layers"];
      //  "layers/iam", "layers/observability"
      dirs.forEach((dir) => {
        fs.mkdirSync(path.join(this.projectPath, dir), { recursive: true });
      });

      spinner.succeed("Directory structure created");
    } catch (error) {
      spinner.fail("Failed to create directory structure");
      throw error;
    }
  }

  private async generateLayerFiles(): Promise<void> {
    const spinner = ora("Generating layer files").start();
    try {
      if (this.options.mode === "advanced") {
        await this.generateAdvancedLayerFiles();
      } else {
        await this.generateSimpleLayerFiles();
      }
      spinner.succeed(".env file created");
      spinner.succeed("ssh_config file created");
      spinner.succeed("Layer files generated");
    } catch (error) {
      spinner.fail("Failed to generate layer files");
      throw error;
    }
  }

  private async generateAdvancedLayerFiles(): Promise<void> {
    const hasEnv = this.options.environments && this.options.environments.length > 0;

    if (hasEnv) {
      // Generate environment-specific files
      this.options.environments!.forEach((env) => {
        createDatacenterFile(this.options, env);
        createComputeFile(this.options, env);
        createClusterFile(this.options, env);
        createFeatureFile(this.options, env);
        createFirewallFile(this.options, env);
        createBastionFile(this.options, env);
        createIAMFile(this.options, env);
        createObservabilityFile(this.options, env);
        createSSHConfig(this.options, env);
        createEnv(this.options, env);
      });
    } else {
      // Generate generic files without environment suffix
      createDatacenterFile(this.options);
      createComputeFile(this.options);
      createClusterFile(this.options);
      createFeatureFile(this.options);
      createFirewallFile(this.options);
      createBastionFile(this.options);
      createObservabilityFile(this.options);
      createIAMFile(this.options);
      createSSHConfig(this.options);
      createEnv(this.options);
    }
  }

  private async generateSimpleLayerFiles(): Promise<void> {
    const hasEnv = this.options.environments && this.options.environments.length > 0;

    if (hasEnv) {
      this.options.environments!.forEach((env) => {
        createSimpleLayerFile(this.options, env);
        createObservabilityFile(this.options, env);
        createSSHConfig(this.options, env);
        createEnv(this.options, env);
      });
    } else {
      createSimpleLayerFile(this.options);
      createObservabilityFile(this.options);
      createSSHConfig(this.options);
      createEnv(this.options);
    }
  }

  private async createSoverstackDirectory(): Promise<void> {
    const spinner = ora("Creating .soverstack directory").start();
    try {
      const soverstackPath = path.join(this.projectPath, ".soverstack");
      fs.mkdirSync(path.join(soverstackPath, "state"), { recursive: true });
      fs.mkdirSync(path.join(soverstackPath, "logs"), { recursive: true });
      fs.mkdirSync(path.join(soverstackPath, "cache"), { recursive: true });

      // Create .gitkeep files
      fs.writeFileSync(path.join(soverstackPath, "state", ".gitkeep"), "");
      fs.writeFileSync(path.join(soverstackPath, "logs", ".gitkeep"), "");
      fs.writeFileSync(path.join(soverstackPath, "cache", ".gitkeep"), "");

      spinner.succeed(".soverstack directory created");
    } catch (error) {
      spinner.fail("Failed to create .soverstack directory");
      throw error;
    }
  }

  private printNextSteps(): void {
    const hasEnv = this.options.environments && this.options.environments.length > 0;

    console.log(chalk.bold("📝 Next Steps:\n"));
    console.log(chalk.gray("1.") + " " + chalk.cyan(`cd ${this.options.projectName}`));

    if (hasEnv) {
      console.log(chalk.gray("2.") + " Configure your infrastructure in:");
      this.options.environments!.forEach((env) => {
        if (this.options.mode === "advanced") {
          console.log(chalk.gray(`   - layers/datacenters/dc-${env}.yaml`));
          console.log(chalk.gray(`   - layers/firewalls/firewall-${env}.yaml`));
          console.log(chalk.gray(`   - layers/bastions/bastion-${env}.yaml`));
          console.log(chalk.gray(`   - layers/iam/iam-${env}.yaml`));
          console.log(chalk.gray(`   - layers/computes/compute-${env}.yaml`));
          console.log(chalk.gray(`   - layers/clusters/k8s-${env}.yaml`));
          console.log(chalk.gray(`   - layers/features/features-${env}.yaml`));
          console.log(chalk.gray(`   - layers/observability/observability-${env}.yaml`));
        } else {
          console.log(chalk.gray(`   - layers/infrastructure-${env}.yaml`));
          console.log(chalk.gray(`   - layers/iam/iam-${env}.yaml`));
          console.log(chalk.gray(`   - layers/observability/observability-${env}.yaml`));
        }
      });
    } else {
      console.log(chalk.gray("2.") + " Configure your infrastructure in:");
      if (this.options.mode === "advanced") {
        console.log(chalk.gray("   - layers/datacenters/datacenter.yaml"));
        console.log(chalk.gray("   - layers/firewalls/firewall.yaml"));
        console.log(chalk.gray("   - layers/bastions/bastion.yaml"));
        console.log(chalk.gray("   - layers/iam/iam.yaml"));
        console.log(chalk.gray("   - layers/computes/compute.yaml"));
        console.log(chalk.gray("   - layers/clusters/k8s.yaml"));
        console.log(chalk.gray("   - layers/features/features.yaml"));
        console.log(chalk.gray("   - layers/observability/observability.yaml"));
      } else {
        console.log(chalk.gray("   - layers/infrastructure.yaml"));
        console.log(chalk.gray("   - layers/iam/iam.yaml"));
        console.log(chalk.gray("   - layers/observability/observability.yaml"));
      }
    }

    console.log(chalk.gray("3.") + " Set environment variables for credentials in the .env file:");

    console.log(chalk.gray("   SSH_PUBLIC_KEY='your-public-key'"));
    console.log(chalk.gray("   SSH_PRIVATE_KEY='your-private-key'"));

    console.log(chalk.gray("4.") + " Validate your configuration:");
    console.log(chalk.gray("   soverstack validate platform.yaml"));

    console.log(chalk.gray("5.") + " Generate and review the execution plan:");
    console.log(chalk.gray("   soverstack plan"));

    console.log(chalk.gray("6.") + " Apply the infrastructure:");
    console.log(chalk.gray("   soverstack apply\n"));

    console.log(
      chalk.yellow("⚠️  Remember: Never commit sensitive files (SSH keys, .env, credentials)")
    );
    console.log(chalk.green("✨ Happy infrastructure coding!\n"));
  }
}
