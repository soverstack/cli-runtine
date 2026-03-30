/**
 * Zod Schemas for Soverstack YAML files
 *
 * These schemas enforce structure, types, formats, and allowed values.
 * Cross-file validation (references, uniqueness, HA) is handled separately
 * by the validators/ layer.
 *
 * Usage:
 *   const result = PlatformSchema.safeParse(yamlData);
 *   if (!result.success) {
 *     // result.error.issues contains structured errors
 *   }
 */

export { PlatformSchema } from "./platform";
export { RegionSchema } from "./region";
export { NodesSchema } from "./nodes";
export { NetworkSchema } from "./network";
export { SshSchema } from "./ssh";
export { WorkloadFileSchema } from "./workload";
