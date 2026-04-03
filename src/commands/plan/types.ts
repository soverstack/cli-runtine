/**
 * Types for plan, apply, and state management.
 */

import crypto from "crypto";

// ════════════════════════════════════════════════════════════════════════════
// STATE
// ════════════════════════════════════════════════════════════════════════════

export interface NetworkState {
  subnet: string;
  vlan?: { id: number; interface: string; mtu: number };
}

export interface ProjectState {
  version: "1.0";
  project_name: string;
  last_apply: string | null; // ISO date

  nodes: Record<string, NodeState>;
  services: Record<string, ServiceState>; // keyed by vm_id

  /** Networks per datacenter, locked after first bootstrap */
  networks?: Record<string, Record<string, NetworkState>>; // dc → network name → config
}

export interface NodeState {
  public_ip: string;
  region: string;
  datacenter: string;
  role: string;
  status: "pending" | "bootstrapped" | "failed";
  bootstrapped_at: string | null;
  config_hash: string;
}

export interface ServiceState {
  name: string;
  role: string;
  scope: string;
  region?: string;
  datacenter?: string;
  implementation: string;
  version: string;
  flavor: string;
  disk?: number;
  image: string;
  host: string;
  status: "running" | "stopped" | "failed";
  created_at: string;
  updated_at: string;
  config_hash: string;
}

export function createEmptyState(projectName: string): ProjectState {
  return {
    version: "1.0",
    project_name: projectName,
    last_apply: null,
    nodes: {},
    services: {},
  };
}

// ════════════════════════════════════════════════════════════════════════════
// DESIRED STATE (parsed from YAML)
// ════════════════════════════════════════════════════════════════════════════

export interface SshKeyRef {
  user: string;
  publicKey: { type: string; path?: string; var_name?: string };
  privateKey: { type: string; path?: string; var_name?: string };
  /** sha256 of public key file content (for change detection) */
  publicKeyHash?: string;
  /** sha256 of private key file content (for change detection) */
  privateKeyHash?: string;
}

export interface DesiredNode {
  name: string;
  public_ip: string;
  region: string;
  datacenter: string;
  role: string;
  capabilities: string[];
  bootstrap: {
    user: string;
    port: number;
    password: { type: string; var_name?: string; path?: string };
  };
  sshUsers: string[];
  sshKeys: SshKeyRef[];
  knockd: { enabled: boolean; sequence?: number[] };
  /** true if .ssh/.previous/ exists for this DC */
  hasPreviousKeys: boolean;
}

export interface DesiredService {
  name: string;
  vm_id: number;
  role: string;
  scope: string;
  region?: string;
  datacenter?: string;
  implementation: string;
  version: string;
  flavor: string;
  disk?: number;
  image: string;
  host: string;
  overwrite_config?: Record<string, unknown>;
}

// ════════════════════════════════════════════════════════════════════════════
// PLAN
// ════════════════════════════════════════════════════════════════════════════

export type ActionType = "create" | "update" | "recreate" | "destroy" | "noop";

export interface NodeAction {
  type: "bootstrap" | "update" | "ssh-rotate" | "noop" | "orphan" | "ssh-blocked";
  node: string;
  public_ip: string;
  region: string;
  datacenter: string;
  role: string;
  changes?: Record<string, { old: string; new: string }>;
  /** Which SSH users need key rotation */
  sshRotation?: { user: string; hasBackup: boolean }[];
}

export interface ServiceAction {
  type: ActionType;
  vm_id: number;
  name: string;
  role: string;
  scope: string;
  region?: string;
  datacenter?: string;
  implementation: string;
  version: string;
  flavor: string;
  disk?: number;
  image: string;
  host: string;
  changes?: Record<string, { old: string | number; new: string | number }>;
}

export interface PlanPhase {
  name: string;
  label: string;
  actions: (NodeAction | ServiceAction)[];
}

export interface Plan {
  project_name: string;
  tier: string;
  state_date: string | null;
  phases: PlanPhase[];
  summary: {
    nodes_bootstrap: number;
    nodes_update: number;
    vms_create: number;
    vms_update: number;
    vms_recreate: number;
    vms_destroy: number;
    vms_noop: number;
  };
}

// ════════════════════════════════════════════════════════════════════════════
// ANSIBLE
// ════════════════════════════════════════════════════════════════════════════

export interface AnsibleTaskResult {
  host: string;
  task: string;
  status: "ok" | "changed" | "failed" | "skipped" | "unreachable";
  msg?: string;
  stderr?: string;
  duration?: number;
}

export interface AnsiblePlayResult {
  play: string;
  tasks: AnsibleTaskResult[];
  success: boolean;
}

// ════════════════════════════════════════════════════════════════════════════
// DEPLOY ORDER
// ════════════════════════════════════════════════════════════════════════════

/** Global services deploy in dependency order */
export const GLOBAL_DEPLOY_ORDER = [
  "database",
  "secrets",
  "identity",
  "dns-authoritative",
  "dns-loadbalancer",
  "mesh",
];

/** Zonal zone services deploy order */
export const ZONAL_ZONE_DEPLOY_ORDER = ["firewall", "loadbalancer"];

/** Zonal hub services deploy order */
export const ZONAL_HUB_DEPLOY_ORDER = ["storage", "backup"];

// ════════════════════════════════════════════════════════════════════════════
// HASH HELPERS
// ════════════════════════════════════════════════════════════════════════════

/** Compute config hash for a node (for change detection).
 *  Includes SSH key content hashes so key regeneration is detected. */
export function hashNode(node: DesiredNode): string {
  const data = JSON.stringify({
    public_ip: node.public_ip,
    role: node.role,
    capabilities: node.capabilities.sort(),
    sshKeys: node.sshKeys.map((k) => ({
      user: k.user,
      pubType: k.publicKey.type,
      pubPath: k.publicKey.path,
      privType: k.privateKey.type,
      privPath: k.privateKey.path,
      pubHash: k.publicKeyHash,
      privHash: k.privateKeyHash,
    })),
    knockd: node.knockd,
  });
  return crypto.createHash("sha256").update(data).digest("hex").slice(0, 12);
}

/** Compute config hash for a service (for change detection) */
export function hashService(svc: DesiredService): string {
  const data = JSON.stringify({
    implementation: svc.implementation,
    version: svc.version,
    flavor: svc.flavor,
    disk: svc.disk,
    image: svc.image,
    host: svc.host,
    overwrite_config: svc.overwrite_config,
  });
  return crypto.createHash("sha256").update(data).digest("hex").slice(0, 12);
}

/**
 * Determine if a service change requires recreate (destructive)
 * vs a simple update (non-destructive).
 */
export function isBreakingChange(
  changes: Record<string, { old: string | number; new: string | number }>
): boolean {
  // Image or host change requires recreate
  return "image" in changes || "host" in changes;
}
