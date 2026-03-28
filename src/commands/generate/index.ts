/**
 * Soverstack Generate Command
 *
 * Parent command for generation utilities.
 *
 * Usage:
 *   soverstack generate ssh [options]
 */

import { Command } from "commander";

import { generateSshCommand } from "../generate-ssh";

export const generateCommand = new Command("generate")
  .description("Generate project resources (SSH keys, etc.)")
  .addCommand(generateSshCommand);
