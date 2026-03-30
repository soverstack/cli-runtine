/**
 * Zod schema for workload files (database.yaml, firewall.yaml, etc.)
 */

import { z } from "zod";
import { ScopeSchema, PositiveInt, SlugSchema } from "./common";
import { IMPLEMENTATIONS } from "@/commands/init/types";

// All known roles
const ALL_ROLES = Object.keys(IMPLEMENTATIONS);

const InstanceSchema = z.object({
  name: z.string().min(1, "Instance name is required"),
  vm_id: z.number().int().min(1, "VM ID must be a positive integer"),
  flavor: z.string().min(1, "Flavor is required (e.g., small, standard, large)"),
  disk: z.number().int().positive().optional(),
  image: z.string().min(1, "Image is required (e.g., debian-12)"),
  host: z.string().min(1, "Host is required (the Proxmox node to deploy on)"),
});

const ServiceSchema = z
  .object({
    role: z.string().min(1, "Service role is required"),
    scope: ScopeSchema,
    region: z.string().optional(),
    datacenter: z.string().optional(),
    implementation: z.string().min(1, "Implementation is required"),
    version: z.string().min(1, "Version is required"),
    instances: z
      .array(InstanceSchema)
      .min(1, "At least one instance is required"),
    overwrite_config: z.record(z.unknown()).nullable().optional(),
  })
  .refine(
    (s) => ALL_ROLES.includes(s.role),
    (s) => ({ message: `Unknown role "${s.role}". Valid roles: ${ALL_ROLES.join(", ")}`, path: ["role"] })
  )
  .refine(
    (s) => {
      const validImpls = IMPLEMENTATIONS[s.role];
      if (!validImpls) return true;
      return validImpls.includes(s.implementation);
    },
    (s) => ({
      message: `Implementation "${s.implementation}" is not supported for role "${s.role}". Supported: ${(IMPLEMENTATIONS[s.role] || []).join(", ")}`,
      path: ["implementation"],
    })
  )
  .refine(
    (s) => {
      if (s.scope === "regional" || s.scope === "zonal") return !!s.region;
      return true;
    },
    { message: "Regional and zonal services must specify a region", path: ["region"] }
  )
  .refine(
    (s) => {
      if (s.scope === "zonal") return !!s.datacenter;
      return true;
    },
    { message: "Zonal services must specify a datacenter", path: ["datacenter"] }
  );

export const WorkloadFileSchema = z.object({
  services: z
    .array(ServiceSchema)
    .min(1, "At least one service definition is required"),
});

export type WorkloadFile = z.infer<typeof WorkloadFileSchema>;
export type Service = z.infer<typeof ServiceSchema>;
export type Instance = z.infer<typeof InstanceSchema>;
