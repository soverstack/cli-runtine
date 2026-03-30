/**
 * Validate workload files (global, regional, zonal)
 *
 * Error messages are written for ops/sysadmin audience,
 * using service names and instance names instead of array indices.
 */

import {
  ValidationResult,
  ParsedWorkloadFile,
  ParsedService,
  ParsedServiceInstance,
  DiscoveredTopology,
  createResult,
  addError,
  addWarning,
  VALID_ROLES,
  VALID_IMPLEMENTATIONS,
  isVmIdInScope,
  ZONE_ROLES,
  HUB_ROLES,
} from "../types";
import { VERSION_CATALOG } from "../../../commands/init/types";

interface WorkloadContext {
  filePath: string;
  expectedScope: string;
  expectedRegion?: string;
  expectedDc?: string;
  expectedDcType?: string;
  topology: DiscoveredTopology;
  allVmIds: Map<number, string>;
  allInstanceNames: Map<string, string>;
}

export function validateWorkloadFile(
  parsed: ParsedWorkloadFile,
  ctx: WorkloadContext,
): ValidationResult {
  const r = createResult();
  const file = ctx.filePath;

  if (!parsed.services || !Array.isArray(parsed.services) || parsed.services.length === 0) {
    addError(r, file, "File must contain at least one service definition", "services");
    return r;
  }

  for (const svc of parsed.services) {
    validateService(r, svc, ctx);
  }

  return r;
}

// ════════════════════════════════════════════════════════════════════════════

/** Human label for a service, e.g. 'Service "database"' or 'Service #2' */
function svcLabel(svc: ParsedService): string {
  return svc.role ? `Service "${svc.role}"` : "Service (missing role)";
}

/** Human label for an instance, e.g. 'instance "db-primary" (vm_id: 1200)' */
function instLabel(inst: ParsedServiceInstance): string {
  const name = inst.name ? `"${inst.name}"` : "(unnamed)";
  const vm = inst.vm_id !== undefined ? ` (vm_id: ${inst.vm_id})` : "";
  return `instance ${name}${vm}`;
}

// ════════════════════════════════════════════════════════════════════════════

function validateService(
  r: ValidationResult,
  svc: ParsedService,
  ctx: WorkloadContext,
): void {
  const file = ctx.filePath;
  const label = svcLabel(svc);

  // ── Scope ────────────────────────────────────────────────────────────
  if (!svc.scope) {
    addError(r, file, `${label}: Missing "scope" property. Expected: "${ctx.expectedScope}"`, "scope");
  } else if (svc.scope !== ctx.expectedScope) {
    addError(
      r, file,
      `${label}: Scope is "${svc.scope}" but this file is in the ${ctx.expectedScope}/ directory. Change scope to "${ctx.expectedScope}"`,
      "scope",
    );
  }

  // ── Role ─────────────────────────────────────────────────────────────
  if (!svc.role) {
    addError(r, file, `A service is missing the "role" property`, "role");
    return;
  }

  const validRolesForScope = VALID_ROLES[ctx.expectedScope] || [];
  if (!validRolesForScope.includes(svc.role)) {
    addError(
      r, file,
      `${label}: Role "${svc.role}" is not valid for ${ctx.expectedScope} services. Valid roles: ${validRolesForScope.join(", ")}`,
      "role",
    );
  }

  // Zonal: check role matches DC type
  if (ctx.expectedScope === "zonal" && ctx.expectedDcType) {
    if (ctx.expectedDcType === "zone" && HUB_ROLES.includes(svc.role)) {
      addError(r, file,
        `${label}: Role "${svc.role}" belongs in a hub datacenter, not a zone. Move this service to a hub-* directory`,
        "role",
      );
    }
    if (ctx.expectedDcType === "hub" && ZONE_ROLES.includes(svc.role)) {
      addError(r, file,
        `${label}: Role "${svc.role}" belongs in a zone datacenter, not a hub. Move this service to a zone-* directory`,
        "role",
      );
    }
  }

  // ── Region (regional/zonal) ──────────────────────────────────────────
  if (ctx.expectedScope === "regional" || ctx.expectedScope === "zonal") {
    if (!svc.region) {
      addError(r, file,
        `${label}: Missing "region" property. ${ctx.expectedScope} services must specify their region`,
        "region",
      );
    } else if (ctx.expectedRegion && svc.region !== ctx.expectedRegion) {
      addError(r, file,
        `${label}: Region is "${svc.region}" but the file is in the ${ctx.expectedRegion}/ directory. Change region to "${ctx.expectedRegion}"`,
        "region",
      );
    }
  }

  // ── Datacenter (zonal) ───────────────────────────────────────────────
  if (ctx.expectedScope === "zonal") {
    if (!svc.datacenter) {
      addError(r, file,
        `${label}: Missing "datacenter" property. Zonal services must specify their datacenter`,
        "datacenter",
      );
    } else if (ctx.expectedDc && svc.datacenter !== ctx.expectedDc) {
      addError(r, file,
        `${label}: Datacenter is "${svc.datacenter}" but the file is in the ${ctx.expectedDc}/ directory. Change datacenter to "${ctx.expectedDc}"`,
        "datacenter",
      );
    }
  }

  // ── Implementation ───────────────────────────────────────────────────
  if (!svc.implementation) {
    addError(r, file, `${label}: Missing "implementation" property (e.g., postgresql, haproxy, vyos...)`, "implementation");
  } else {
    const validImpls = VALID_IMPLEMENTATIONS[svc.role];
    if (validImpls && !validImpls.includes(svc.implementation)) {
      addError(r, file,
        `${label}: Implementation "${svc.implementation}" is not supported for this role. Supported: ${validImpls.join(", ")}`,
        "implementation",
      );
    }
  }

  // ── Version ──────────────────────────────────────────────────────────
  if (!svc.version) {
    addError(r, file, `${label}: Missing "version" property`, "version");
  } else if (svc.implementation) {
    const versionInfo = VERSION_CATALOG[svc.implementation];
    if (versionInfo && !versionInfo.supported.includes(svc.version)) {
      addWarning(r, file,
        `${label}: Version "${svc.version}" is not in the tested versions for ${svc.implementation}. Tested versions: ${versionInfo.supported.join(", ")}`,
        "version",
      );
    }
  }

  // ── Instances ────────────────────────────────────────────────────────
  if (!svc.instances || !Array.isArray(svc.instances) || svc.instances.length === 0) {
    addError(r, file, `${label}: Must have at least one instance`, "instances");
    return;
  }

  for (const inst of svc.instances) {
    validateInstance(r, file, label, inst, svc, ctx);
  }
}

// ════════════════════════════════════════════════════════════════════════════

function validateInstance(
  r: ValidationResult,
  file: string,
  svcLabel: string,
  inst: ParsedServiceInstance,
  svc: ParsedService,
  ctx: WorkloadContext,
): void {
  const iLabel = instLabel(inst);
  const fullLabel = `${svcLabel}, ${iLabel}`;

  // ── Name ─────────────────────────────────────────────────────────────
  if (!inst.name) {
    addError(r, file, `${svcLabel}: An instance is missing a "name"`, "instances.name");
  } else {
    const existingFile = ctx.allInstanceNames.get(inst.name);
    if (existingFile) {
      addError(r, file,
        `${fullLabel}: Instance name "${inst.name}" is already used in ${existingFile}. Each instance must have a unique name across the entire project`,
        "instances.name",
      );
    } else {
      ctx.allInstanceNames.set(inst.name, file);
    }
  }

  // ── VM ID ────────────────────────────────────────────────────────────
  if (inst.vm_id === undefined || inst.vm_id === null) {
    addError(r, file, `${fullLabel}: Missing "vm_id"`, "instances.vm_id");
  } else {
    // Global uniqueness
    const existingFile = ctx.allVmIds.get(inst.vm_id);
    if (existingFile) {
      addError(r, file,
        `${fullLabel}: VM ID ${inst.vm_id} is already used in ${existingFile}. Each VM ID must be unique across the entire project`,
        "instances.vm_id",
      );
    } else {
      ctx.allVmIds.set(inst.vm_id, file);
    }

    // Scope range check
    if (ctx.expectedScope === "global") {
      if (!isVmIdInScope(inst.vm_id, "global")) {
        addError(r, file,
          `${fullLabel}: VM ID ${inst.vm_id} is outside the global range (1000-1499). Global services must use IDs between 1000 and 1499. See VM_ID_SCHEME.md`,
          "instances.vm_id",
        );
      }
    } else if (ctx.expectedScope === "regional" || ctx.expectedScope === "zonal") {
      if (inst.vm_id < 100000) {
        addError(r, file,
          `${fullLabel}: VM ID ${inst.vm_id} is too low for ${ctx.expectedScope} services (must be >= 100000). See VM_ID_SCHEME.md`,
          "instances.vm_id",
        );
      }
    }
  }

  // ── Flavor ───────────────────────────────────────────────────────────
  if (!inst.flavor) {
    addError(r, file, `${fullLabel}: Missing "flavor" (e.g., small, standard, large)`, "instances.flavor");
  } else if (!ctx.topology.flavorNames.includes(inst.flavor)) {
    addError(r, file,
      `${fullLabel}: Flavor "${inst.flavor}" is not defined in platform.yaml. Available flavors: ${ctx.topology.flavorNames.join(", ")}`,
      "instances.flavor",
    );
  }

  // ── Image ────────────────────────────────────────────────────────────
  if (!inst.image) {
    addError(r, file, `${fullLabel}: Missing "image" (e.g., debian-12, ubuntu-24)`, "instances.image");
  } else if (!ctx.topology.imageNames.includes(inst.image)) {
    addError(r, file,
      `${fullLabel}: Image "${inst.image}" is not defined in platform.yaml. Available images: ${ctx.topology.imageNames.join(", ")}`,
      "instances.image",
    );
  }

  // ── Host ─────────────────────────────────────────────────────────────
  if (!inst.host) {
    addError(r, file, `${fullLabel}: Missing "host" (the Proxmox node to deploy on)`, "instances.host");
  } else {
    let targetDc: string | undefined;

    if (ctx.expectedScope === "zonal") {
      targetDc = ctx.expectedDc;
    } else if (ctx.expectedScope === "global") {
      targetDc = ctx.topology.globalPlacementDc;
    } else if (ctx.expectedScope === "regional" && ctx.expectedRegion) {
      const regionDcs = ctx.topology.allDatacenters.filter((dc) => dc.region === ctx.expectedRegion);
      const allRegionNodes = regionDcs.flatMap((dc) => ctx.topology.allNodeNames.get(dc.name) || []);
      if (allRegionNodes.length > 0 && !allRegionNodes.includes(inst.host)) {
        addError(r, file,
          `${fullLabel}: Host "${inst.host}" was not found in any datacenter of region "${ctx.expectedRegion}". Check the node name in your nodes.yaml files`,
          "instances.host",
        );
      }
      return;
    }

    if (targetDc) {
      const dcNodes = ctx.topology.allNodeNames.get(targetDc) || [];
      if (dcNodes.length > 0 && !dcNodes.includes(inst.host)) {
        addError(r, file,
          `${fullLabel}: Host "${inst.host}" was not found in ${targetDc}/nodes.yaml. Available nodes: ${dcNodes.join(", ")}`,
          "instances.host",
        );
      }
    }
  }
}
