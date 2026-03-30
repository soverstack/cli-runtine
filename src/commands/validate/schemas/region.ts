/**
 * Zod schema for region.yaml
 */

import { z } from "zod";
import { SlugSchema, DomainSchema } from "./common";

export const RegionSchema = z.object({
  name: SlugSchema,
  description: z.string().optional(),
  dns_zone: DomainSchema,
  hub: z
    .string()
    .regex(/^hub-[a-z0-9-]+$/, 'Hub name must start with "hub-" (e.g., hub-eu)')
    .optional(),
  compliance: z.array(z.string()).default([]),
});

export type Region = z.infer<typeof RegionSchema>;
