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

      // Build a human-readable message that includes the field path
      let message = issue.message;
      if (field) {
        // Resolve the field name to something readable
        // e.g., "flavors.2.disk" → 'Field "disk" in flavors[2]'
        const readablePath = formatPath(issue.path);
        // Avoid duplicating if the message already mentions the field
        if (!message.toLowerCase().includes(readablePath.toLowerCase())) {
          message = `${readablePath}: ${message}`;
        }
      }

      addError(r, file, message, field);
    }
  }

  return r;
}

/**
 * Convert a Zod path like ["flavors", 2, "disk"] to a readable string
 * like 'Flavor #3, field "disk"' or 'flavors[2].disk'
 */
function formatPath(parts: (string | number)[]): string {
  // Try to make it human-friendly
  const segments: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const next = parts[i + 1];

    if (typeof part === "string" && typeof next === "number") {
      // "flavors", 2 → 'flavors[2]'
      segments.push(`${part}[${next}]`);
      i++; // skip the number

      // If there's a field after the index, add it
      const field = parts[i + 1];
      if (typeof field === "string") {
        segments.push(`"${field}"`);
        i++;
      }
    } else if (typeof part === "string") {
      segments.push(`"${part}"`);
    } else {
      segments.push(`[${part}]`);
    }
  }

  return segments.join(" → ");
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
