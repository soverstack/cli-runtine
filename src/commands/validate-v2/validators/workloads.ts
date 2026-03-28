/**
 * Validate workload files (global, regional, zonal)
 */

import {
  ValidationResult,
  ParsedWorkloadFile,
  ParsedService,
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
import { VERSION_CATALOG } from "../../../commands/init-v2/types";

interface WorkloadContext {
  filePath: string; // relative path for error messages
  expectedScope: string; // "global" | "regional" | "zonal"
  expectedRegion?: string; // for regional/zonal
  expectedDc?: string; // for zonal
  expectedDcType?: string; // "hub" | "zone" for zonal
  topology: DiscoveredTopology;
  // Shared state for cross-file uniqueness
  allVmIds: Map<number, string>; // vm_id -> file where defined
  allInstanceNames: Map<string, string>; // name -> file where defined
}

export function validateWorkloadFile(
  parsed: ParsedWorkloadFile,
  ctx: WorkloadContext,
): ValidationResult {
  const r = createResult();
  const file = ctx.filePath;

  if (!parsed.services || !Array.isArray(parsed.services) || parsed.services.length === 0) {
    addError(r, file, "At least one service is required", "services");
    return r;
  }

  for (let i = 0; i < parsed.services.length; i++) {
    validateService(r, parsed.services[i], ctx, i);
  }

  return r;
}

function validateService(
  r: ValidationResult,
  svc: ParsedService,
  ctx: WorkloadContext,
  index: number,
): void {
  const file = ctx.filePath;
  const prefix = `services[${index}]`;

  // ── Scope ────────────────────────────────────────────────────────────
  if (!svc.scope) {
    addError(r, file, `${prefix}: scope is required`, `${prefix}.scope`);
  } else if (svc.scope !== ctx.expectedScope) {
    addError(
      r,
      file,
      `${prefix}: scope "${svc.scope}" does not match file location (expected "${ctx.expectedScope}")`,
      `${prefix}.scope`,
    );
  }

  // ── Role ─────────────────────────────────────────────────────────────
  if (!svc.role) {
    addError(r, file, `${prefix}: role is required`, `${prefix}.role`);
    return; // Can't validate further without role
  }

  const validRolesForScope = VALID_ROLES[ctx.expectedScope] || [];
  if (!validRolesForScope.includes(svc.role)) {
    addError(
      r,
      file,
      `${prefix}: role "${svc.role}" is not valid for scope ${ctx.expectedScope}. Valid: ${validRolesForScope.join(", ")}`,
      `${prefix}.role`,
    );
  }

  // Zonal: check role matches DC type
  if (ctx.expectedScope === "zonal" && ctx.expectedDcType) {
    if (ctx.expectedDcType === "zone" && HUB_ROLES.includes(svc.role)) {
      addError(r, file, `${prefix}: role "${svc.role}" is for hubs, not zones`, `${prefix}.role`);
    }
    if (ctx.expectedDcType === "hub" && ZONE_ROLES.includes(svc.role)) {
      addError(r, file, `${prefix}: role "${svc.role}" is for zones, not hubs`, `${prefix}.role`);
    }
  }

  // ── Region (regional/zonal) ──────────────────────────────────────────
  if (ctx.expectedScope === "regional" || ctx.expectedScope === "zonal") {
    if (!svc.region) {
      addError(
        r,
        file,
        `${prefix}: region is required for ${ctx.expectedScope} scope`,
        `${prefix}.region`,
      );
    } else if (ctx.expectedRegion && svc.region !== ctx.expectedRegion) {
      addError(
        r,
        file,
        `${prefix}: region "${svc.region}" does not match directory (expected "${ctx.expectedRegion}")`,
        `${prefix}.region`,
      );
    }
  }

  // ── Datacenter (zonal) ───────────────────────────────────────────────
  if (ctx.expectedScope === "zonal") {
    if (!svc.datacenter) {
      addError(
        r,
        file,
        `${prefix}: datacenter is required for zonal scope`,
        `${prefix}.datacenter`,
      );
    } else if (ctx.expectedDc && svc.datacenter !== ctx.expectedDc) {
      addError(
        r,
        file,
        `${prefix}: datacenter "${svc.datacenter}" does not match directory (expected "${ctx.expectedDc}")`,
        `${prefix}.datacenter`,
      );
    }
  }

  // ── Implementation ───────────────────────────────────────────────────
  if (!svc.implementation) {
    addError(r, file, `${prefix}: implementation is required`, `${prefix}.implementation`);
  } else {
    const validImpls = VALID_IMPLEMENTATIONS[svc.role];
    if (validImpls && !validImpls.includes(svc.implementation)) {
      addError(
        r,
        file,
        `${prefix}: implementation "${svc.implementation}" is not valid for role ${svc.role}. Valid: ${validImpls.join(", ")}`,
        `${prefix}.implementation`,
      );
    }
  }

  // ── Version ──────────────────────────────────────────────────────────
  if (!svc.version) {
    addError(r, file, `${prefix}: version is required`, `${prefix}.version`);
  } else if (svc.implementation) {
    const versionInfo = VERSION_CATALOG[svc.implementation];
    if (versionInfo && !versionInfo.supported.includes(svc.version)) {
      addWarning(
        r,
        file,
        `${prefix}: version "${svc.version}" is not in supported list for ${svc.implementation}: ${versionInfo.supported.join(", ")}`,
        `${prefix}.version`,
      );
    }
  }

  // ── Instances ────────────────────────────────────────────────────────
  if (!svc.instances || !Array.isArray(svc.instances) || svc.instances.length === 0) {
    addError(r, file, `${prefix}: at least one instance is required`, `${prefix}.instances`);
    return;
  }

  for (let j = 0; j < svc.instances.length; j++) {
    const inst = svc.instances[j];
    const instPrefix = `${prefix}.instances[${j}]`;

    // Name
    if (!inst.name) {
      addError(r, file, `${instPrefix}: name is required`, `${instPrefix}.name`);
    } else {
      const existingFile = ctx.allInstanceNames.get(inst.name);
      if (existingFile) {
        addError(
          r,
          file,
          `${instPrefix}: duplicate instance name "${inst.name}" (also in ${existingFile})`,
          `${instPrefix}.name`,
        );
      } else {
        ctx.allInstanceNames.set(inst.name, file);
      }
    }

    // VM ID
    if (inst.vm_id === undefined || inst.vm_id === null) {
      addError(r, file, `${instPrefix}: vm_id is required`, `${instPrefix}.vm_id`);
    } else {
      // Global uniqueness
      const existingFile = ctx.allVmIds.get(inst.vm_id);
      if (existingFile) {
        addError(
          r,
          file,
          `${instPrefix}: duplicate vm_id ${inst.vm_id} (also in ${existingFile})`,
          `${instPrefix}.vm_id`,
        );
      } else {
        ctx.allVmIds.set(inst.vm_id, file);
      }

      // Scope check: vm_id must be in the correct scope range
      if (ctx.expectedScope === "global") {
        if (!isVmIdInScope(inst.vm_id, "global")) {
          addError(
            r,
            file,
            `${instPrefix}: vm_id ${inst.vm_id} is outside global range (1000-1499)`,
            `${instPrefix}.vm_id`,
          );
        }
      } else if (ctx.expectedScope === "regional" || ctx.expectedScope === "zonal") {
        if (inst.vm_id < 100000) {
          addError(
            r,
            file,
            `${instPrefix}: vm_id ${inst.vm_id} is too low for ${ctx.expectedScope} scope (must be >= 100000)`,
            `${instPrefix}.vm_id`,
          );
        }
      }
    }

    // Flavor
    if (!inst.flavor) {
      addError(r, file, `${instPrefix}: flavor is required`, `${instPrefix}.flavor`);
    } else if (!ctx.topology.flavorNames.includes(inst.flavor)) {
      addError(
        r,
        file,
        `${instPrefix}: flavor "${inst.flavor}" not found in platform.yaml`,
        `${instPrefix}.flavor`,
      );
    }

    // Image
    if (!inst.image) {
      addError(r, file, `${instPrefix}: image is required`, `${instPrefix}.image`);
    } else if (!ctx.topology.imageNames.includes(inst.image)) {
      addError(
        r,
        file,
        `${instPrefix}: image "${inst.image}" not found in platform.yaml`,
        `${instPrefix}.image`,
      );
    }

    // Host
    if (!inst.host) {
      addError(r, file, `${instPrefix}: host is required`, `${instPrefix}.host`);
    } else {
      // Determine target DC for host validation
      let targetDc: string | undefined;
      if (ctx.expectedScope === "zonal") {
        targetDc = ctx.expectedDc;
      } else if (ctx.expectedScope === "global") {
        targetDc = ctx.topology.globalPlacementDc;
      } else if (ctx.expectedScope === "regional" && ctx.expectedRegion) {
        // Regional: host should be in any DC of that region
        const regionDcs = ctx.topology.allDatacenters.filter(
          (dc) => dc.region === ctx.expectedRegion,
        );
        const allRegionNodes = regionDcs.flatMap(
          (dc) => ctx.topology.allNodeNames.get(dc.name) || [],
        );
        if (allRegionNodes.length > 0 && !allRegionNodes.includes(inst.host)) {
          addError(
            r,
            file,
            `${instPrefix}: host "${inst.host}" not found in any datacenter of region ${ctx.expectedRegion}`,
            `${instPrefix}.host`,
          );
        }
        return; // Skip the DC-specific check below
      }

      if (targetDc) {
        const dcNodes = ctx.topology.allNodeNames.get(targetDc) || [];
        if (dcNodes.length > 0 && !dcNodes.includes(inst.host)) {
          addError(
            r,
            file,
            `${instPrefix}: host "${inst.host}" not found in ${targetDc} nodes.yaml`,
            `${instPrefix}.host`,
          );
        }
      }
    }
  }
}
