#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';

// Import des commandes
import { initCommand } from './commands/init';
import { validateCommand } from './commands/validate';
import { generateSshKeysCommand } from './commands/generate-ssh';
import { addCommand } from './commands/add';
import { generateCommand } from './commands/generate';

const program = new Command();

// Configuration du CLI
program
  .name('soverstack')
  .description('Soverstack Runtime - Sovereign Infrastructure Orchestration')
  .version('1.0.0');

// Ajouter toutes les commandes
program.addCommand(initCommand);
program.addCommand(validateCommand);
program.addCommand(generateSshKeysCommand);
program.addCommand(addCommand);
program.addCommand(generateCommand);

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
