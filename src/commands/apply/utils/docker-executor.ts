import { spawn } from "child_process";
import path from "path";
import fs from "fs";

/**
 * Docker executor for Terraform and Ansible
 */
export class DockerExecutor {
  private dockerImage: string;
  private workDir: string;

  constructor(dockerImage: string = "soverstack/terraform-ansible:latest", workDir: string) {
    this.dockerImage = dockerImage;
    this.workDir = workDir;
  }

  /**
   * Executes Terraform command in Docker
   */
  async executeTerraform(
    command: string[],
    envVars: Record<string, string> = {}
  ): Promise<{ success: boolean; output: string; error?: string }> {
    const dockerArgs = [
      "run",
      "--rm",
      "-v",
      `${this.workDir}:/workspace`,
      "-w",
      "/workspace/terraform",
    ];

    // Add environment variables (SECURITY: from env vars, not hardcoded)
    Object.entries(envVars).forEach(([key, value]) => {
      dockerArgs.push("-e", `${key}=${value}`);
    });

    dockerArgs.push(this.dockerImage, "terraform", ...command);

    return this.executeDocker(dockerArgs);
  }

  /**
   * Executes Ansible command in Docker
   */
  async executeAnsible(
    command: string[],
    envVars: Record<string, string> = {},
    inventoryPath?: string
  ): Promise<{ success: boolean; output: string; error?: string }> {
    const dockerArgs = [
      "run",
      "--rm",
      "-v",
      `${this.workDir}:/workspace`,
      "-w",
      "/workspace",
    ];

    // Add SSH keys volume (if path provided)
    const sshKeyPath = envVars.SSH_PRIVATE_KEY_PATH;
    if (sshKeyPath && fs.existsSync(sshKeyPath)) {
      dockerArgs.push("-v", `${sshKeyPath}:/root/.ssh/id_rsa:ro`);
    }

    // Add environment variables
    Object.entries(envVars).forEach(([key, value]) => {
      // SECURITY: Never log sensitive env vars
      if (!this.isSensitiveEnvVar(key)) {
        dockerArgs.push("-e", `${key}=${value}`);
      } else {
        // Load from host env
        dockerArgs.push("-e", key);
      }
    });

    // Add inventory path
    if (inventoryPath) {
      dockerArgs.push("-e", `ANSIBLE_INVENTORY=${inventoryPath}`);
    }

    dockerArgs.push(this.dockerImage, "ansible-playbook", ...command);

    return this.executeDocker(dockerArgs);
  }

  /**
   * Executes Docker command
   */
  private executeDocker(
    args: string[]
  ): Promise<{ success: boolean; output: string; error?: string }> {
    return new Promise((resolve) => {
      let output = "";
      let error = "";

      const docker = spawn("docker", args, {
        stdio: ["inherit", "pipe", "pipe"],
        env: {
          ...process.env,
          // Ensure Docker uses UTF-8
          LANG: "en_US.UTF-8",
        },
      });

      docker.stdout?.on("data", (data) => {
        const text = data.toString();
        output += text;

        // SECURITY: Filter sensitive data from output
        const sanitized = this.sanitizeOutput(text);
        process.stdout.write(sanitized);
      });

      docker.stderr?.on("data", (data) => {
        const text = data.toString();
        error += text;

        // SECURITY: Filter sensitive data from errors
        const sanitized = this.sanitizeOutput(text);
        process.stderr.write(sanitized);
      });

      docker.on("close", (code) => {
        resolve({
          success: code === 0,
          output: this.sanitizeOutput(output),
          error: code !== 0 ? this.sanitizeOutput(error) : undefined,
        });
      });

      docker.on("error", (err) => {
        resolve({
          success: false,
          output: "",
          error: `Docker execution failed: ${err.message}`,
        });
      });
    });
  }

  /**
   * SECURITY: Sanitizes output to remove sensitive data
   */
  private sanitizeOutput(text: string): string {
    let sanitized = text;

    // Remove common secret patterns
    const secretPatterns = [
      /password["\s:=]+[^\s"]+/gi,
      /secret["\s:=]+[^\s"]+/gi,
      /token["\s:=]+[^\s"]+/gi,
      /api[_-]?key["\s:=]+[^\s"]+/gi,
      /-----BEGIN [A-Z ]+ KEY-----[\s\S]+?-----END [A-Z ]+ KEY-----/gi,
      /ssh-rsa\s+[A-Za-z0-9+/=]+/gi,
      /ssh-ed25519\s+[A-Za-z0-9+/=]+/gi,
    ];

    secretPatterns.forEach((pattern) => {
      sanitized = sanitized.replace(pattern, "[REDACTED]");
    });

    return sanitized;
  }

  /**
   * Checks if env var name indicates sensitive data
   */
  private isSensitiveEnvVar(name: string): boolean {
    const sensitivePatterns = [
      "PASSWORD",
      "SECRET",
      "TOKEN",
      "API_KEY",
      "PRIVATE_KEY",
      "ACCESS_KEY",
      "PASSPHRASE",
    ];

    return sensitivePatterns.some((pattern) => name.includes(pattern));
  }

  /**
   * Pulls Docker image
   */
  async pullImage(): Promise<boolean> {
    console.log(`Pulling Docker image: ${this.dockerImage}...`);

    const result = await this.executeDocker(["pull", this.dockerImage]);

    if (result.success) {
      console.log("Docker image pulled successfully");
    } else {
      console.error(`Failed to pull Docker image: ${result.error}`);
    }

    return result.success;
  }

  /**
   * Checks if Docker is available
   */
  async checkDocker(): Promise<boolean> {
    try {
      const result = await this.executeDocker(["--version"]);
      return result.success;
    } catch {
      return false;
    }
  }
}

/**
 * Generates Terraform configuration from plan
 */
export function generateTerraformConfig(plan: any, outputDir: string): void {
  const terraformDir = path.join(outputDir, "terraform");

  if (!fs.existsSync(terraformDir)) {
    fs.mkdirSync(terraformDir, { recursive: true });
  }

  // Generate main.tf
  const mainTf = generateMainTf(plan);
  fs.writeFileSync(path.join(terraformDir, "main.tf"), mainTf);

  // Generate variables.tf
  const variablesTf = generateVariablesTf();
  fs.writeFileSync(path.join(terraformDir, "variables.tf"), variablesTf);

  // Generate terraform.tfvars (without secrets!)
  const tfvars = generateTfvars(plan);
  fs.writeFileSync(path.join(terraformDir, "terraform.tfvars"), tfvars);
}

/**
 * Generates main.tf
 */
function generateMainTf(plan: any): string {
  return `# Generated by Soverstack
# DO NOT EDIT MANUALLY

terraform {
  required_version = ">= 1.0"

  required_providers {
    proxmox = {
      source  = "Telmate/proxmox"
      version = "~> 2.9"
    }
  }
}

# Proxmox provider
provider "proxmox" {
  pm_api_url      = var.proxmox_api_url
  pm_user         = var.proxmox_user
  # SECURITY: Password from env var
  pm_password     = var.proxmox_password
  pm_tls_insecure = var.proxmox_tls_insecure
}

# Resources will be generated based on plan
${generateProxmoxResources(plan)}
`;
}

/**
 * Generates Proxmox resources
 */
function generateProxmoxResources(plan: any): string {
  let resources = "";

  // Generate resources based on plan
  // This is a simplified version - full implementation would generate all resources

  resources += `
# Proxmox VMs
# Full resource generation based on plan goes here
`;

  return resources;
}

/**
 * Generates variables.tf
 */
function generateVariablesTf(): string {
  return `# Terraform variables
# SECURITY: Actual values come from env vars or terraform.tfvars

variable "proxmox_api_url" {
  description = "Proxmox API URL"
  type        = string
}

variable "proxmox_user" {
  description = "Proxmox user"
  type        = string
  default     = "root@pam"
}

variable "proxmox_password" {
  description = "Proxmox password (from env var)"
  type        = string
  sensitive   = true
}

variable "proxmox_tls_insecure" {
  description = "Skip TLS verification"
  type        = bool
  default     = true
}

variable "infrastructure_tier" {
  description = "Infrastructure tier (local, production, enterprise)"
  type        = string
}
`;
}

/**
 * Generates terraform.tfvars (without secrets!)
 */
function generateTfvars(plan: any): string {
  return `# Terraform variables
# SECURITY: Secrets are loaded from env vars, not this file!

infrastructure_tier = "${plan.infrastructure_tier}"

# Proxmox configuration
# SECURITY: Use env vars for credentials:
# export TF_VAR_proxmox_api_url="https://proxmox.example.com:8006/api2/json"
# export TF_VAR_proxmox_password="$PROXMOX_PASSWORD"
`;
}
