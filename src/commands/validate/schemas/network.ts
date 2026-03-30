/**
 * Zod schema for network.yaml
 */

import { z } from "zod";
import { CidrSchema, PositiveInt } from "./common";

const VlanSchema = z
  .object({
    id: z.number().int().min(1, "VLAN id must be a positive integer"),
    name: z.string().min(1, "VLAN name is required"),
    subnet: z.union([CidrSchema, z.literal("")]).optional(),
    gateway: z.string().optional(),
    mesh: z.boolean(),
    mtu: PositiveInt.default(1500),
  })
  .refine(
    (v) => !v.mesh || (v.mesh && v.gateway && v.gateway.length > 0),
    { message: "Mesh VLANs require a gateway address (the firewall VM will be deployed here)", path: ["gateway"] }
  );

const AllocatedBlockSchema = z.object({
  block: z.string().default(""),     // Validated as warning by the validators/ layer
  gateway: z.string().default(""),
  usable_range: z.string().default(""),
});

const BgpSchema = z.object({
  asn: PositiveInt.describe("Your ASN number"),
  upstream_asn: PositiveInt.describe("Upstream provider ASN"),
  ip_blocks: z.array(z.string()).min(1, "At least one IP block is required"),
});

const PublicIpsSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("allocated_block"),
    allocated_block: AllocatedBlockSchema,
  }),
  z.object({
    type: z.literal("bgp"),
    bgp: BgpSchema,
  }),
]);

export const NetworkSchema = z
  .object({
    vlans: z
      .array(VlanSchema)
      .min(1, "At least one VLAN is required"),
    public_ips: PublicIpsSchema.optional(),
  })
  .refine(
    (n) => {
      const ids = n.vlans.map((v) => v.id);
      return new Set(ids).size === ids.length;
    },
    { message: "VLAN ids must be unique within a datacenter", path: ["vlans"] }
  );

export type Network = z.infer<typeof NetworkSchema>;
