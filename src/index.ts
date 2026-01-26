#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';

// Import des commandes
import { initCommand } from './commands/init';
import { initV2Command } from './commands/init-v2';
import { validateCommand } from './commands/validate';
import { planCommand } from './commands/plan';
import { applyCommand } from './commands/apply';
import { destroyCommand } from './commands/destroy';
import { dnsUpdateCommand } from './commands/dns-update';
import { graphCommand } from './commands/graph';
import { generateSshKeysCommand } from './commands/generate-ssh';

const program = new Command();

// Configuration du CLI
program
  .name('soverstack')
  .description('Soverstack Runtime - Sovereign Infrastructure Orchestration')
  .version('1.0.0');

// Ajouter toutes les commandes
program.addCommand(initCommand);
program.addCommand(initV2Command);
program.addCommand(validateCommand);
program.addCommand(planCommand);
program.addCommand(applyCommand);
program.addCommand(destroyCommand);
program.addCommand(dnsUpdateCommand);
program.addCommand(graphCommand);
program.addCommand(generateSshKeysCommand);

// Gestion des erreurs globales
process.on('unhandledRejection', (error: Error) => {
  console.error(chalk.red('Unhandled error:'), error.message);
  process.exit(1);
});

process.on('uncaughtException', (error: Error) => {
  console.error(chalk.red('Uncaught exception:'), error.message);
  process.exit(1);
});

// Parse et exécute
program.parse(process.argv);
