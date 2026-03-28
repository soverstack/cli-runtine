/**
 * Soverstack Add Command
 *
 * Add regions or zones to an existing project.
 *
 * Usage:
 *   soverstack add region [name]
 *   soverstack add zone [region] [zone-name]
 */

import { Command } from "commander";

import { addRegionCommand } from "./region";
import { addZoneCommand } from "./zone";

export const addCommand = new Command("add")
  .description("Add regions or zones to an existing project")
  .addCommand(addRegionCommand)
  .addCommand(addZoneCommand);
