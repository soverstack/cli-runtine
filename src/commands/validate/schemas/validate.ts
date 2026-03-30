/**
 * Schema validation runner
 *
 * Runs Zod schemas on parsed YAML data and converts Zod errors
 * to human-readable ValidationIssues.
 */

import { z } from "zod";
import { ValidationResult, createResult, addError, addWarning } from "../types";

import { PlatformSchema } from "./platform";
import { RegionSchema } from "./region";
import { NodesSchema } from "./nodes";
import { NetworkSchema } from "./network";
import { SshSchema } from "./ssh";
import { WorkloadFileSchema } from "./workload";

// ════════════════════════════════════════════════════════════════════════════
// RUNNER
// ════════════════════════════════════════════════════════════════════════════

/**
 * Validate any data against a Zod schema and return ValidationResult.
 */
function runSchema(
  schema: z.ZodTypeAny,
  data: unknown,
  file: string,
): ValidationResult {
  const r = createResult();
  const result = schema.safeParse(data);

  if (!result.success) {
    for (const issue of result.error.issues) {
      const field = issue.path.length > 0 ? issue.path.join(".") : undefined;
      addError(r, file, issue.message, field);
    }
  }

  return r;
}

// ════════════════════════════════════════════════════════════════════════════
// PUBLIC API
// ════════════════════════════════════════════════════════════════════════════

export function validatePlatformSchema(data: unknown, file: string = "platform.yaml"): ValidationResult {
  return runSchema(PlatformSchema, data, file);
}

export function validateRegionSchema(data: unknown, file: string): ValidationResult {
  return runSchema(RegionSchema, data, file);
}

export function validateNodesSchema(data: unknown, file: string): ValidationResult {
  return runSchema(NodesSchema, data, file);
}

export function validateNetworkSchema(data: unknown, file: string): ValidationResult {
  return runSchema(NetworkSchema, data, file);
}

export function validateSshSchema(data: unknown, file: string): ValidationResult {
  return runSchema(SshSchema, data, file);
}

export function validateWorkloadSchema(data: unknown, file: string): ValidationResult {
  return runSchema(WorkloadFileSchema, data, file);
}
