/**
 * Zod schema for platform.yaml
 */

import { z } from "zod";
import {
  SlugSchema,
  DomainSchema,
  PositiveInt,
  TierSchema,
  ComplianceSchema,
  StateBackendSchema,
  CredentialRefSchema,
} from "./common";

const ImageSchema = z.object({
  name: z.string().min(1, "Image name is required"),
  url: z.string().url("Image URL must be a valid URL"),
  default: z.boolean().optional(),
});

const FlavorSchema = z.object({
  name: z.string().min(1, "Flavor name is required"),
  cpu: PositiveInt.describe("CPU cores"),
  ram: PositiveInt.describe("RAM in MB"),
  disk: PositiveInt.describe("Disk in GB"),
});

const RemoteStateSchema = z.object({
  url: z.string().url("Remote state URL must be a valid URL"),
  credentials: CredentialRefSchema,
});

const StateSchema = z
  .object({
    backend: StateBackendSchema,
    path: z.string().min(1, "State path is required"),
    remote: RemoteStateSchema.optional(),
  })
  .refine(
    (s) => s.backend !== "remote" || s.remote !== undefined,
    { message: "Remote state backend requires a 'remote' section with url and credentials", path: ["remote"] }
  );

const GlobalPlacementSchema = z.object({
  datacenter: z.string().min(1, "Control plane datacenter is required (e.g., zone-paris)"),
});

export const PlatformSchema = z
  .object({
    project_name: SlugSchema,
    version: z.string().min(1, "Version is required"),
    domain: DomainSchema,
    infrastructure_tier: TierSchema,
    compliance_level: ComplianceSchema,
    images: z
      .array(ImageSchema)
      .min(1, "At least one cloud image is required"),
    flavors: z
      .array(FlavorSchema)
      .min(1, "At least one VM flavor is required"),
    defaults: z.object({
      global_placement: GlobalPlacementSchema,
    }),
    state: StateSchema,
  })
  .refine(
    (p) => {
      const names = p.images.map((i) => i.name);
      return new Set(names).size === names.length;
    },
    { message: "Image names must be unique", path: ["images"] }
  )
  .refine(
    (p) => {
      const defaults = p.images.filter((i) => i.default === true);
      return defaults.length === 1;
    },
    { message: "Exactly one image must be marked as default", path: ["images"] }
  )
  .refine(
    (p) => {
      const names = p.flavors.map((f) => f.name);
      return new Set(names).size === names.length;
    },
    { message: "Flavor names must be unique", path: ["flavors"] }
  );

/** Inferred type from the schema */
export type Platform = z.infer<typeof PlatformSchema>;
