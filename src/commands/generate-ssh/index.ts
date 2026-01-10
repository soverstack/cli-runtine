import { Command } from 'commander';
import chalk from 'chalk';

export const generateSshKeysCommand = new Command('generate:ssh-keys')
  .description('Generate SSH keys for the project')
  .option('-o, --output <path>', 'Output directory', './ssh')
  .option('--key-type <type>', 'Key type (rsa, ed25519)', 'ed25519')
  .option('--key-size <size>', 'Key size for RSA', '4096')
  .action(async (options: { output: string; keyType: string; keySize: string }) => {
    console.log(chalk.blue('🔐 Generating SSH keys...'));
    console.log(chalk.gray(`Output: ${options.output}`));
    console.log(chalk.gray(`Key type: ${options.keyType}`));

    // TODO: Implémenter la génération de clés SSH
    console.log(chalk.yellow('⚠️  Command not yet implemented'));
  });
