/**
 * State manager — read/write .soverstack/state/state.json
 */

import fs from "fs";
import path from "path";
import { ProjectState, createEmptyState, ServiceState } from "./types";

const STATE_DIR = ".soverstack/state";
const STATE_FILE = "state.json";

/**
 * Load project state. Returns empty state if file doesn't exist.
 */
export function loadState(projectPath: string, projectName: string): ProjectState {
  const filePath = path.join(projectPath, STATE_DIR, STATE_FILE);
  if (!fs.existsSync(filePath)) {
    return createEmptyState(projectName);
  }

  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw) as ProjectState;
  } catch {
    return createEmptyState(projectName);
  }
}

/**
 * Save project state.
 */
export function saveState(projectPath: string, state: ProjectState): void {
  const dirPath = path.join(projectPath, STATE_DIR);
  fs.mkdirSync(dirPath, { recursive: true });

  const filePath = path.join(dirPath, STATE_FILE);
  fs.writeFileSync(filePath, JSON.stringify(state, null, 2) + "\n");
}

/**
 * Check if state has any data (not a first run).
 */
export function hasState(state: ProjectState): boolean {
  return state.last_apply !== null;
}

/**
 * Get formatted date of last apply.
 */
export function stateDate(state: ProjectState): string {
  if (!state.last_apply) return "empty";
  return state.last_apply.split("T")[0];
}

/**
 * Update a node in state after bootstrap.
 */
export function markNodeBootstrapped(state: ProjectState, nodeName: string, address: string, region: string, datacenter: string, role: string, configHash: string): void {
  state.nodes[nodeName] = {
    address,
    region,
    datacenter,
    role,
    status: "bootstrapped",
    bootstrapped_at: new Date().toISOString(),
    config_hash: configHash,
  };
}

/**
 * Update a service in state after create/update.
 */
export function markServiceRunning(state: ProjectState, vmId: number, svc: Omit<ServiceState, "status" | "created_at" | "updated_at">): void {
  const key = String(vmId);
  const now = new Date().toISOString();
  const existing = state.services[key];

  state.services[key] = {
    ...svc,
    status: "running",
    created_at: existing?.created_at || now,
    updated_at: now,
  };
}

/**
 * Remove a service from state after destroy.
 */
export function removeService(state: ProjectState, vmId: number): void {
  delete state.services[String(vmId)];
}

/**
 * Remove a node from state.
 */
export function removeNode(state: ProjectState, nodeName: string): void {
  delete state.nodes[nodeName];
}
