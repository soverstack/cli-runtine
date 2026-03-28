/**
 * Generate workloads/global/secrets.yaml
 */

import fs from "fs";
import path from "path";
import { GeneratorContext } from "../../../types";

export function generateSecretsYaml(ctx: GeneratorContext): void {
  const { projectPath, options } = ctx;
  const globalDir = path.join(projectPath, "workloads", "global");
  const filePath = path.join(globalDir, "secrets.yaml");

  fs.mkdirSync(globalDir, { recursive: true });

  const primaryNodePrefix = `pve-${options.primaryRegion}-${options.primaryZone}`;
  const isLocal = options.infrastructureTier === "local";

  // Raft needs odd number of nodes (1, 3, 5) for quorum
  const nodeCount = isLocal ? 1 : 3;

  const instances = Array.from({ length: nodeCount }, (_, i) => {
    const num = String(i + 1).padStart(2, "0");
    return `      - name: secrets-${num}
        vm_id: ${150 + i}
        flavor: small
        image: debian-12
        host: ${primaryNodePrefix}-${num}`;
  }).join("\n\n");

  const content = `# ==============================================================================
# SECRETS - GLOBAL
# ==============================================================================
#
# Secrets management, encryption, and PKI for the platform.
# Uses Raft integrated storage (no database dependency).
#
# ==============================================================================

services:
  # ============================================================================
  # SECRETS
  # ============================================================================
  - role: secrets
    scope: global
    implementation: openbao        # openbao | vault | infisical
    version: "2.1"               # 2.1, 2.0
    instances:
${instances}
    overwrite_config:
      # storage:
        # backend: raft               # Integrated storage, no DB needed
        # backend: postgresql       # Alternative: use database cluster
      # backup:
        # schedule: "0 */6 * * *"     # Every 6 hours
        # retention: 30               # Keep 30 days
        # destination: storage        # Backup to storage service (MinIO)
      # ui: true
      # log_level: info
      # max_lease_ttl: 768h
`;

  fs.writeFileSync(filePath, content.trim() + "\n");
}
