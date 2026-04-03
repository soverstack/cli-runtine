/**
 * Zod schema for nodes.yaml
 */

import { z } from "zod";
import { Ipv4Schema, PortSchema, NodeRoleSchema, CredentialRefSchema } from "./common";

const NodeCapability = z.enum(["compute", "nvme", "ceph", "hdd", "backup", "gpu"]);

const BootstrapSchema = z.object({
  user: z.string().min(1, "Bootstrap user is required (usually root)"),
  port: PortSchema.default(22),
  password: CredentialRefSchema,
});

const NodeSchema = z.object({
  name: z.string().min(1, "Node name is required"),
  public_ip: Ipv4Schema,
  role: NodeRoleSchema,
  capabilities: z.array(NodeCapability).default([]),
  bootstrap: BootstrapSchema.optional(),
});

const CephSchema = z.object({
  enabled: z.boolean(),
  pool_name: z.string().optional(),
});

export const NodesSchema = z
  .object({
    nodes: z
      .array(NodeSchema)
      .min(1, "At least one Proxmox node is required"),
    ceph: CephSchema.optional(),
  })
  .refine(
    (n) => {
      const names = n.nodes.map((node) => node.name);
      return new Set(names).size === names.length;
    },
    { message: "Node names must be unique within a datacenter", path: ["nodes"] }
  )
  .refine(
    (n) => {
      const primaries = n.nodes.filter((node) => node.role === "primary");
      return primaries.length === 1;
    },
    { message: "Exactly one node must have role: primary", path: ["nodes"] }
  );

export type Nodes = z.infer<typeof NodesSchema>;
