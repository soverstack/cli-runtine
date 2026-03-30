/**
 * Zod schema for ssh.yaml
 */

import { z } from "zod";
import { PositiveInt, CredentialRefSchema } from "./common";

const RotationPolicySchema = z
  .object({
    max_age_days: PositiveInt,
    warning_days: PositiveInt,
  })
  .refine(
    (rp) => rp.warning_days < rp.max_age_days,
    { message: "warning_days must be less than max_age_days", path: ["warning_days"] }
  );

const KnockdSchema = z
  .object({
    enabled: z.boolean(),
    sequence: z.array(z.number().int()).optional(),
    seq_timeout: PositiveInt.optional(),
    port_timeout: PositiveInt.optional(),
  })
  .refine(
    (k) => {
      if (!k.enabled) return true;
      return k.sequence && k.sequence.length > 0 && k.seq_timeout && k.port_timeout;
    },
    { message: "When knockd is enabled, sequence, seq_timeout, and port_timeout are required" }
  );

const SshUserSchema = z.object({
  user: z.string().min(1, "SSH username is required"),
  groups: z.array(z.string()).default([]),
  shell: z.string().default("/bin/bash"),
  public_key: CredentialRefSchema,
  private_key: CredentialRefSchema,
});

export const SshSchema = z.object({
  rotation_policy: RotationPolicySchema,
  knockd: KnockdSchema,
  users: z
    .array(SshUserSchema)
    .min(2, "At least 2 SSH users are required (for safe key rotation — one can update the other)"),
});

export type Ssh = z.infer<typeof SshSchema>;
