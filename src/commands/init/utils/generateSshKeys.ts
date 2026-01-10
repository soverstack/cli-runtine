import fs from "fs";
import path from "path";
import chalk from "chalk";
import ora from "ora";
import { generateKeyPairSync, createPublicKey } from "crypto";

export const generateSshKeys = async (projectPath: string): Promise<void> => {
  const spinner = ora("Generating SSH keys").start();
  try {
    const sshPath = path.join(projectPath, "ssh");
    const keyPath = path.join(sshPath, "id_rsa");

    // Ensure ssh directory exists
    fs.mkdirSync(sshPath, { recursive: true });

    // Generate RSA key pair using Node crypto (cross-platform)
    const { privateKey, publicKey } = generateKeyPairSync("rsa", {
      modulusLength: 4096,
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs1", format: "pem" },
    });

    // Try to export public key in OpenSSH format; fall back to PEM if not supported
    let publicKeyContent: string = publicKey;
    try {
      const pubKeyObj = createPublicKey(publicKey);
      // export as OpenSSH (e.g. "ssh-rsa AAAA...") when supported
      // if not supported, this will throw and we keep the PEM
      // @ts-ignore
      publicKeyContent = pubKeyObj.export({ type: "spki", format: "ssh" }).toString();
    } catch (e) {
      // keep PEM as fallback
    }

    fs.writeFileSync(keyPath, privateKey, { mode: 0o600 });
    fs.writeFileSync(`${keyPath}.pub`, publicKeyContent);

    // Try to set file permissions; ignore errors on platforms that don't support it
    try {
      fs.chmodSync(keyPath, 0o600);
    } catch (_) {}
    try {
      fs.chmodSync(`${keyPath}.pub`, 0o644);
    } catch (_) {}

    spinner.succeed("SSH keys generated");
  } catch (error) {
    spinner.warn("Failed to generate SSH keys (ssh-keygen not available)");
    console.log(chalk.yellow("  You can generate SSH keys manually later"));
  }
};
