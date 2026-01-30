/**
 * Generate workloads/global/database.yaml - PostgreSQL
 */

import fs from "fs";
import path from "path";
import { GeneratorContext } from "../../../types";

export function generateDatabaseYaml(ctx: GeneratorContext): void {
  const { projectPath, options } = ctx;
  const globalDir = path.join(projectPath, "workloads", "global");
  const filePath = path.join(globalDir, "database.yaml");

  fs.mkdirSync(globalDir, { recursive: true });

  const primaryNodePrefix = `pve-${options.primaryRegion}-${options.primaryZone}`;

  const nodeCount =
    options.infrastructureTier === "local"
      ? 1
      : options.infrastructureTier === "production"
      ? 2
      : 3;

  const instances = Array.from({ length: nodeCount }, (_, i) => {
    const num = String(i + 1).padStart(2, "0");
    const name = i === 0 ? "db-primary" : `db-replica-${num}`;
    return `      - name: ${name}
        vm_id: ${250 + i}
        flavor: large
        image: debian-12
        host: ${primaryNodePrefix}-${num}`;
  }).join("\n\n");

  const content = `# ==============================================================================
# DATABASE - GLOBAL
# ==============================================================================
#
# Global database cluster for platform services.
#
# ==============================================================================

services:
  # ============================================================================
  # DATABASE
  # ============================================================================
  - role: database
    scope: global
    implementation: postgresql    # postgresql | mysql | mariadb
    version: "16"               # 16, 15, 14
    instances:
${instances}
    databases:
      - name: keycloak
        owner: keycloak
      - name: grafana
        owner: grafana
    overwrite_config:
      # max_connections: 200
      # shared_buffers: 512MB
      # work_mem: 16MB
`;

  fs.writeFileSync(filePath, content.trim() + "\n");
}
