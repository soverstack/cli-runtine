/**
 * Zod schema for network.yaml
 */

import { z } from "zod";
import { CidrSchema, PositiveInt } from "./common";

const VlanBackingSchema = z.object({
  id: z.number().int().min(1, "VLAN id must be a positive integer"),
  interface: z.string().min(1, "VLAN interface is required (e.g., eth1)"),
  mtu: PositiveInt.describe("MTU: 1500 (standard) or 9000 (jumbo frames)"),
});

const NetworkEntrySchema = z.object({
  subnet: z.union([CidrSchema, z.literal("")]),
  gateway: z.string().optional(),
  vlan: VlanBackingSchema.optional(),
});

const IndividualAddressSchema = z.object({
  ip: z.string().min(1, "IP address is required"),
  attached_to: z.string().min(1, "attached_to node name is required"),
});

const PublicIpsSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("individual"),
    addresses: z.array(IndividualAddressSchema).min(1, "At least one address is required"),
  }),
  z.object({
    type: z.literal("block"),
    block: z.string().default(""),
    gateway: z.string().default(""),
    usable: z.string().default(""),
  }),
  z.object({
    type: z.literal("bgp"),
    asn: PositiveInt.describe("Your ASN number"),
    block: z.string().min(1, "IP block is required"),
    upstream_peer: z.string().min(1, "Upstream peer IP is required"),
  }),
]);

export const NetworkSchema = z.object({
  networks: z.record(z.string(), NetworkEntrySchema).refine(
    (n) => "management" in n,
    { message: "A 'management' network is required" }
  ),
  public_ips: PublicIpsSchema.optional(),
});

export type Network = z.infer<typeof NetworkSchema>;
