import { InitOptions } from "./index";
import fs from "fs";
import path from "path";

export const createSecurityFile = ({
  projectName,
  infrastructureTier,
  outputDir,
}: InitOptions): void => {
  // Use outputDir if provided (for services/ folder), otherwise use project root
  const targetDir = outputDir || path.resolve(process.cwd(), projectName);
  const filePath = path.join(targetDir, "security.yaml");

  const isLocal = infrastructureTier === "local";

  // VM IDs based on tier (HA for production)
  const openbaoVmIds = isLocal ? "[150]" : "[150, 151]";
  const keycloakVmIds = isLocal ? "[200]" : "[200, 201]";

  const content = `# ════════════════════════════════════════════════════════════════════════════
# GLOBAL SECURITY
# ════════════════════════════════════════════════════════════════════════════
#
# Global security services (VMs, not K8s).
#
# VM ID Ranges:
#   OpenBao:  150-159  (secrets management)
#   Keycloak: 200-209  (identity & SSO)
#
# VM specs: see compute.yaml (type: security-std, iam-std)
# Customize: create apps/openbao.yaml, apps/keycloak.yaml
#
# ════════════════════════════════════════════════════════════════════════════

openbao:
  vm_ids: ${openbaoVmIds}
  subdomain: vault
  database: openbao
  vpn_only: true
  root_token:
    type: env
    var_name: OPENBAO_ROOT_TOKEN

keycloak:
  vm_ids: ${keycloakVmIds}
  subdomain: auth
  database: keycloak
  vpn_only: false
  admin:
    password:
      type: env
      var_name: KEYCLOAK_ADMIN_PASSWORD
`;

  fs.writeFileSync(filePath, content);
};
