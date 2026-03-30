/**
 * Shared Zod schemas and helpers
 */

import { z } from "zod";
import {
  IMPLEMENTATIONS,
  VERSION_CATALOG,
} from "@/commands/init/types";

// ════════════════════════════════════════════════════════════════════════════
// PRIMITIVES
// ════════════════════════════════════════════════════════════════════════════

/** Lowercase alphanumeric with hyphens (project names, region names, etc.) */
export const SlugSchema = z
  .string()
  .regex(/^[a-z0-9-]+$/, "Must be lowercase letters, numbers, and hyphens only");

/** Valid domain name */
export const DomainSchema = z
  .string()
  .regex(/^[a-z0-9]+([-\.]{1}[a-z0-9]+)*\.[a-z]{2,}$/i, "Must be a valid domain (e.g., example.com)");

/** IPv4 address */
export const Ipv4Schema = z
  .string()
  .regex(/^(\d{1,3}\.){3}\d{1,3}$/, "Must be a valid IPv4 address (e.g., 10.1.10.10)")
  .refine((ip) => {
    const octets = ip.split(".").map(Number);
    return octets.every((o) => o >= 0 && o <= 255);
  }, "IP octets must be between 0 and 255");

/** CIDR notation */
export const CidrSchema = z
  .string()
  .regex(/^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/, "Must be valid CIDR (e.g., 10.1.10.0/24)");

/** Positive integer */
export const PositiveInt = z.number().int().positive();

/** Port number */
export const PortSchema = z.number().int().min(1).max(65535);

// ════════════════════════════════════════════════════════════════════════════
// ENUMS (from init/types.ts — single source of truth)
// ════════════════════════════════════════════════════════════════════════════

export const TierSchema = z.enum(["local", "production", "enterprise"]);
export const ComplianceSchema = z.enum(["startup", "business", "enterprise", "regulated"]);
export const StateBackendSchema = z.enum(["local", "remote"]);
export const NodeRoleSchema = z.enum(["primary", "secondary"]);
export const ScopeSchema = z.enum(["global", "regional", "zonal"]);
export const DcTypeSchema = z.enum(["hub", "zone"]);

export const CredentialRefSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("env"),
    var_name: z.string().min(1, "Environment variable name is required"),
  }),
  z.object({
    type: z.literal("vault"),
    path: z.string().min(1, "Vault path is required"),
  }),
  z.object({
    type: z.literal("file"),
    path: z.string().min(1, "File path is required"),
  }),
]);

// ════════════════════════════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════════════════════════════

/**
 * Build a Zod enum from the IMPLEMENTATIONS map for a given role
 */
export function implEnum(role: string): z.ZodEnum<[string, ...string[]]> {
  const impls = IMPLEMENTATIONS[role];
  if (!impls || impls.length === 0) {
    return z.enum(["unknown"]);
  }
  return z.enum(impls as [string, ...string[]]);
}

/**
 * Validate a version string against VERSION_CATALOG (returns warning, not error)
 */
export function isVersionSupported(impl: string, version: string): boolean {
  const info = VERSION_CATALOG[impl];
  if (!info) return true; // Unknown impl, skip version check
  return info.supported.includes(version);
}
