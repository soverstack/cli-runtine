/**
 * Soverstack Init V2 Command
 *
 * New structure: inventory/ + workloads/
 *
 * Usage:
 *   soverstack init-v2 <project-name>
 *   soverstack init-v2 my-project --domain example.com --regions eu,us
 */

import { Command } from "commander";
import chalk from "chalk";
import inquirer from "inquirer";

import { ProjectInitializer } from "./logic";
import { InitOptions, RegionConfig } from "./types";
import { InfrastructureTierType, ComplianceLevel } from "@/types";

export const initV2Command = new Command("init-v2")
  .description("Initialize a new Soverstack project (v2 structure)")
  .argument("[project-name]", "Name of the project")
  .option("--domain <domain>", "Domain name (e.g., example.com)")
  .option("--tier <tier>", "Infrastructure tier: local, production, enterprise")
  .option("--regions <regions>", "Regions and zones (e.g., 'eu:paris,lyon;us:oregon')")
  .option("--non-interactive", "Skip interactive prompts", false)
  .action(async (projectName: string | undefined, options: any) => {
    try {
      // Header
      console.log("");
      console.log(chalk.cyan.bold("  ╔═══════════════════════════════════════════════════════════════════╗"));
      console.log(chalk.cyan.bold("  ║") + chalk.white.bold("                    SOVERSTACK INIT V2                            ") + chalk.cyan.bold("║"));
      console.log(chalk.cyan.bold("  ║") + chalk.gray("              inventory/ + workloads/ structure                  ") + chalk.cyan.bold("║"));
      console.log(chalk.cyan.bold("  ╚═══════════════════════════════════════════════════════════════════╝"));
      console.log("");

      // Non-interactive mode
      if (options.nonInteractive) {
        const initOptions = buildOptionsFromFlags(projectName, options);
        const initializer = new ProjectInitializer(initOptions);
        await initializer.initialize();
        return;
      }

      // Interactive mode
      const initOptions = await collectOptionsInteractively(projectName, options);
      const initializer = new ProjectInitializer(initOptions);
      await initializer.initialize();
    } catch (error) {
      console.log(chalk.red("\nInitialization failed:"));
      console.log(chalk.red((error as Error).message));
      process.exit(1);
    }
  });

// ════════════════════════════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════════════════════════════

function parseRegionsFlag(regionsStr: string): RegionConfig[] {
  // Format: "eu:paris,lyon;us:oregon" → [{name: "eu", zones: ["paris", "lyon"]}, ...]
  return regionsStr.split(";").map((regionStr) => {
    const [name, zonesStr] = regionStr.split(":");
    const zones = zonesStr ? zonesStr.split(",").map((z) => z.trim()) : ["main"];
    return { name: name.trim(), zones };
  });
}

function buildOptionsFromFlags(projectName: string | undefined, flags: any): InitOptions {
  const regions = flags.regions ? parseRegionsFlag(flags.regions) : [{ name: "eu", zones: ["main"] }];
  const tier = (flags.tier as InfrastructureTierType) || "production";

  return {
    projectName: projectName || "my-soverstack-project",
    domain: flags.domain || "example.com",
    regions,
    primaryRegion: regions[0].name,
    primaryZone: regions[0].zones[0],
    generateSshKeys: false,
    infrastructureTier: tier,
    complianceLevel: "startup" as ComplianceLevel,
    skipHubs: tier === "local",
  };
}

async function collectOptionsInteractively(
  projectName: string | undefined,
  flags: any
): Promise<InitOptions> {
  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 1: Basic info
  // ═══════════════════════════════════════════════════════════════════════════
  const phase1: any = {};

  if (!projectName) {
    const answer = await inquirer.prompt([
      {
        type: "input",
        name: "projectName",
        message: "Project name:",
        default: "my-soverstack-project",
        validate: (input: string) => {
          if (!input || input.trim().length === 0) return "Required";
          if (!/^[a-z0-9-]+$/.test(input)) return "Lowercase, numbers, hyphens only";
          return true;
        },
      },
    ]);
    phase1.projectName = answer.projectName;
  }

  if (!flags.domain) {
    const answer = await inquirer.prompt([
      {
        type: "input",
        name: "domain",
        message: "Domain name:",
        default: "example.com",
        validate: (input: string) => {
          if (!input) return "Required";
          if (!/^[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,}$/i.test(input)) return "Invalid format";
          return true;
        },
      },
    ]);
    phase1.domain = answer.domain;
  }

  if (!flags.tier) {
    const answer = await inquirer.prompt([
      {
        type: "list",
        name: "tier",
        message: "Infrastructure tier:",
        choices: [
          { name: "Local - Single node, HA optional", value: "local" },
          { name: "Production - 3+ nodes, HA enforced", value: "production" },
          { name: "Enterprise - 5+ nodes, full HA, Backup enforced", value: "enterprise" },
        ],
        default: "production",
      },
    ]);
    phase1.tier = answer.tier;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 2: Regions (comma-separated)
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("");
  console.log(chalk.gray("  ┌─────────────────────────────────────────────────────────────────────┐"));
  console.log(chalk.gray("  │  ") + chalk.cyan.bold("STEP 1: REGIONS") + chalk.gray("                                                    │"));
  console.log(chalk.gray("  ├─────────────────────────────────────────────────────────────────────┤"));
  console.log(chalk.gray("  │  Geographic areas (eu, us, asia,eu-west,eu-east).                   │"));
  console.log(chalk.gray("  │  Each region gets:                                                  │"));
  console.log(chalk.gray("  │  - ") + chalk.white("hub") + chalk.gray(" (backup/storage) - auto-created") + (phase1.tier === "local" ? chalk.yellow(" [disabled in local]") : "") + chalk.gray(phase1.tier === "local" ? "          │":"                              │"));
  console.log(chalk.gray("  │  - ") + chalk.white("zones") + chalk.gray(" (production compute)                                       │"));
  console.log(chalk.gray("  └─────────────────────────────────────────────────────────────────────┘"));
  console.log("");

  const { regionNames } = await inquirer.prompt([
    {
      type: "input",
      name: "regionNames",
      message: "Regions (comma-separated):",
      default: "eu",
      validate: (input: string) => {
        if (!input) return "At least one region required";
        const parts = input.split(",").map((r) => r.trim());
        const invalid = parts.find((r) => !/^[a-z0-9-]+$/.test(r));
        if (invalid) return `Invalid: ${invalid}`;
        const duplicates = parts.filter((r, i) => parts.indexOf(r) !== i);
        if (duplicates.length > 0) return `Duplicate: ${duplicates[0]}`;
        return true;
      },
    },
  ]);

  const regionNameList = regionNames.split(",").map((r: string) => r.trim());
  const regions: RegionConfig[] = [];

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 3: Zones for each region
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("");
  console.log(chalk.gray("  ┌─────────────────────────────────────────────────────────────────────┐"));
  console.log(chalk.gray("  │  ") + chalk.cyan.bold("STEP 2: ZONES") + chalk.gray("                                                      │"));
  console.log(chalk.gray("  ├─────────────────────────────────────────────────────────────────────┤"));
  console.log(chalk.gray("  │  Production datacenters for each region (NVMe + Ceph).              │"));
  console.log(chalk.gray("  └─────────────────────────────────────────────────────────────────────┘"));
  console.log("");

  const isLocal = phase1.tier === "local";
  const createdHubs: { name: string; region: string }[] = [];

  for (const regionName of regionNameList) {
    const { zoneNames } = await inquirer.prompt([
      {
        type: "input",
        name: "zoneNames",
        message: `Zones for ${chalk.cyan(regionName)} (comma-separated):`,
        default: regionName === "eu" ? "paris" : "main",
        validate: (input: string) => {
          if (!input) return "At least one zone required";
          const parts = input.split(",").map((z) => z.trim());
          const invalid = parts.find((z) => !/^[a-z0-9-]+$/.test(z));
          if (invalid) return `Invalid: ${invalid}`;
          return true;
        },
      },
    ]);

    const zones = zoneNames.split(",").map((z: string) => z.trim());

    // Hub selection (skip for local tier)
    let hub: string | undefined;
    if (!isLocal) {
      if (createdHubs.length === 0) {
        // First region - auto create hub
        hub = `hub-${regionName}`;
        createdHubs.push({ name: hub, region: regionName });
        console.log(chalk.gray(`  → Hub: ${hub} (first hub, auto-created)`));
      } else {
        // Ask: create new or use existing?
        const { hubChoice } = await inquirer.prompt([
          {
            type: "list",
            name: "hubChoice",
            message: `Hub for ${chalk.cyan(regionName)}:`,
            choices: [
              { name: `Create new hub (hub-${regionName})`, value: "new" },
              ...createdHubs.map((h) => ({
                name: `Use ${h.name} (from ${h.region})`,
                value: h.name,
              })),
            ],
          },
        ]);

        if (hubChoice === "new") {
          hub = `hub-${regionName}`;
          createdHubs.push({ name: hub, region: regionName });
        } else {
          hub = hubChoice;
        }
      }
    }

    regions.push({ name: regionName, zones, hub });
  }

  // Show created structure
  console.log("");
  console.log(chalk.white("  Datacenters:"));
  regions.forEach((r) => {
    if (!isLocal && r.hub) {
      const isOwn = r.hub === `hub-${r.name}`;
      if (isOwn) {
        console.log(chalk.gray(`    ${r.hub}`) + chalk.dim(" (backup)"));
      } else {
        console.log(chalk.gray(`    → uses ${r.hub}`) + chalk.dim(" (shared)"));
      }
    }
    r.zones.forEach((z) => {
      console.log(chalk.white(`    zone-${z}`) + chalk.dim(` (${r.name})`));
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 4: SSH Key Generation
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("");
  console.log(chalk.gray("  ┌─────────────────────────────────────────────────────────────────────┐"));
  console.log(chalk.gray("  │  ") + chalk.cyan.bold("SSH KEYS") + chalk.gray("                                                           │"));
  console.log(chalk.gray("  ├─────────────────────────────────────────────────────────────────────┤"));
  console.log(chalk.gray("  │  Soverstack needs SSH keys to access your servers.                  │"));
  console.log(chalk.gray("  │  One key pair per datacenter per user (admin + backup).             │"));
  console.log(chalk.gray("  │                                                                     │"));
  console.log(chalk.gray("  │  ") + chalk.yellow("If you skip, generate keys later with:") + chalk.gray("                           │"));
  console.log(chalk.gray("  │  ") + chalk.cyan("soverstack generate:ssh-keys") + chalk.gray("                                       │"));
  console.log(chalk.gray("  └─────────────────────────────────────────────────────────────────────┘"));
  console.log("");

  const { generateKeys } = await inquirer.prompt([
    {
      type: "list",
      name: "generateKeys",
      message: "Generate SSH keys for each datacenter?",
      choices: [
        { name: "Yes - Generate keys automatically (recommended)", value: true },
        { name: "No - I will generate keys manually", value: false },
      ],
      default: 0, // First choice = Yes
    },
  ]);

  phase1.generateSshKeys = generateKeys;

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 5: Control plane selection
  // ═══════════════════════════════════════════════════════════════════════════
  console.log("");
  console.log(chalk.gray("  ┌─────────────────────────────────────────────────────────────────────┐"));
  console.log(chalk.gray("  │  ") + chalk.cyan.bold("STEP 3: CONTROL PLANE") + chalk.gray("                                              │"));
  console.log(chalk.gray("  ├─────────────────────────────────────────────────────────────────────┤"));
  console.log(chalk.gray("  │  Where global services run: Vault, Keycloak, PostgreSQL, Headscale  │"));
  console.log(chalk.gray("  └─────────────────────────────────────────────────────────────────────┘"));
  console.log("");

  // Build list of all zones
  const allZones: { name: string; value: { region: string; zone: string } }[] = [];
  for (const region of regions) {
    for (const zone of region.zones) {
      allZones.push({
        name: `${region.name}/zone-${zone}`,
        value: { region: region.name, zone },
      });
    }
  }

  let primaryRegion = regions[0].name;
  let primaryZone = regions[0].zones[0];

  if (allZones.length > 1) {
    const { primary } = await inquirer.prompt([
      {
        type: "list",
        name: "primary",
        message: "Control plane datacenter:",
        choices: allZones,
      },
    ]);
    primaryRegion = primary.region;
    primaryZone = primary.zone;
  } else {
    console.log(chalk.gray(`  Auto-selected: ${primaryRegion}/zone-${primaryZone}`));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════════════════════════════════════
  const finalProjectName = projectName || phase1.projectName;
  const finalDomain = flags.domain || phase1.domain;
  const finalTier = flags.tier || phase1.tier;

  console.log("");
  console.log(chalk.gray("  ┌─────────────────────────────────────────────────────────────────────┐"));
  console.log(chalk.gray("  │  ") + chalk.green.bold("SUMMARY") + chalk.gray("                                                            │"));
  console.log(chalk.gray("  ├─────────────────────────────────────────────────────────────────────┤"));
  console.log(chalk.gray("  │  Project:      ") + chalk.white(finalProjectName.padEnd(51)) + chalk.gray("│"));
  console.log(chalk.gray("  │  Domain:       ") + chalk.white(finalDomain.padEnd(51)) + chalk.gray("│"));
  console.log(chalk.gray("  │  Tier:         ") + chalk.white(finalTier.padEnd(51)) + chalk.gray("│"));
  console.log(chalk.gray("  │  Control:      ") + chalk.cyan(`${primaryRegion}/zone-${primaryZone}`.padEnd(51)) + chalk.gray("│"));
  console.log(chalk.gray("  │  SSH Keys:     ") + (phase1.generateSshKeys ? chalk.green("Generate".padEnd(51)) : chalk.yellow("Manual".padEnd(51))) + chalk.gray("│"));
  console.log(chalk.gray("  ├─────────────────────────────────────────────────────────────────────┤"));
  console.log(chalk.gray("  │  ") + chalk.white.bold("Datacenters:") + chalk.gray("                                                       │"));
  regions.forEach((r) => {
    // Region header
    console.log(chalk.gray("  │  ") + chalk.white(`  ${r.name}:`.padEnd(53)) + chalk.gray("│"));

    // Hub info (skip for local tier)
    if (!isLocal && r.hub) {
      const isOwnHub = r.hub === `hub-${r.name}`;
      if (isOwnHub) {
        const hubLine = `    ${r.hub} (backup)`.padEnd(53);
        console.log(chalk.gray("  │  ") + chalk.dim(hubLine) + chalk.gray("│"));
      } else {
        const hubLine = `    → uses ${r.hub} (shared)`.padEnd(53);
        console.log(chalk.gray("  │  ") + chalk.yellow(hubLine) + chalk.gray("│"));
      }
    }

    // Zones
    r.zones.forEach((z) => {
      const isControl = r.name === primaryRegion && z === primaryZone;
      const zoneLine = `    zone-${z}${isControl ? " (control plane)" : ""}`.padEnd(53);
      console.log(chalk.gray("  │  ") + (isControl ? chalk.cyan(zoneLine) : chalk.white(zoneLine)) + chalk.gray("│"));
    });
  });
  if (isLocal) {
    console.log(chalk.gray("  │  ") + chalk.yellow("    (hubs disabled in local tier)".padEnd(53)) + chalk.gray("│"));
  }
  console.log(chalk.gray("  └─────────────────────────────────────────────────────────────────────┘"));
  console.log("");

  // Confirm
  const { confirm } = await inquirer.prompt([
    {
      type: "confirm",
      name: "confirm",
      message: "Create project with this configuration?",
      default: true,
    },
  ]);

  if (!confirm) {
    console.log(chalk.yellow("\nAborted."));
    process.exit(0);
  }

  return {
    projectName: finalProjectName,
    domain: finalDomain,
    regions,
    primaryRegion,
    primaryZone,
    generateSshKeys: phase1.generateSshKeys,
    infrastructureTier: finalTier as InfrastructureTierType,
    complianceLevel: "startup" as ComplianceLevel,
    skipHubs: isLocal, // Skip hub generation in local mode
  };
}
