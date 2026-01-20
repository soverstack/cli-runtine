import { NormalizedInfrastructure } from "./normalizer";
import {
  Datacenter,
  NetworkingConfig,
  SecurityConfig,
  ComputeConfig,
  DatabasesLayer,
  K8sCluster,
  AppsConfig,
} from "@/types";

/**
 * Represents an infrastructure resource in the plan
 */
export interface PlanResource {
  id: string;
  type: ResourceType;
  layer: PlanLayerType;
  action: ResourceAction;
  data: any;
  dependencies: string[];
  metadata: {
    created_at?: string;
    updated_at?: string;
    checksum?: string;
  };
}

/**
 * Types of infrastructure resources
 */
export type ResourceType =
  // Datacenter layer
  | "proxmox_server"
  | "backup_server"
  | "storage_backend"
  | "ceph_server"
  | "network_bridge"
  // Networking layer
  | "public_ip_config"
  | "vrrp_failover"
  | "firewall_vm"
  | "vpn_server"
  | "dns_zone"
  | "powerdns_server"
  // Security layer
  | "vault_server"
  | "sso_server"
  // Compute layer
  | "vm"
  | "lxc_container"
  | "instance_type"
  // Database layer
  | "database_cluster"
  | "database"
  // K8s layer
  | "k8s_master"
  | "k8s_worker"
  | "haproxy"
  | "k8s_network"
  | "ingress_controller"
  | "metallb_pool"
  // Apps layer
  | "app";

/**
 * Actions to perform on resources
 */
export type ResourceAction = "create" | "update" | "delete" | "no-op";

/**
 * Layer types for plan
 */
export type PlanLayerType =
  | "datacenter"
  | "networking"
  | "security"
  | "compute"
  | "database"
  | "k8s"
  | "apps";

/**
 * Complete infrastructure plan
 */
export interface InfrastructurePlan {
  version: string;
  generated_at: string;
  infrastructure_tier: "local" | "production" | "enterprise";
  resources: PlanResource[];
  execution_order: string[][];
  summary: {
    to_create: number;
    to_update: number;
    to_delete: number;
    no_change: number;
  };
  validation_passed: boolean;
}

/**
 * Generates an infrastructure plan from normalized configuration
 */
export function generatePlan(
  normalized: NormalizedInfrastructure,
  existingPlan?: InfrastructurePlan
): InfrastructurePlan {
  const resources: PlanResource[] = [];

  // Generate resources from each layer
  if (normalized.datacenter) {
    resources.push(...generateDatacenterResources(normalized.datacenter));
  }

  if (normalized.networking) {
    resources.push(...generateNetworkingResources(normalized.networking));
  }

  if (normalized.security) {
    resources.push(...generateSecurityResources(normalized.security));
  }

  if (normalized.compute) {
    resources.push(...generateComputeResources(normalized.compute));
  }

  if (normalized.database) {
    resources.push(...generateDatabaseResources(normalized.database));
  }

  if (normalized.k8s) {
    resources.push(...generateK8sResources(normalized.k8s));
  }

  if (normalized.apps) {
    resources.push(...generateAppsResources(normalized.apps));
  }

  // Determine actions by comparing with existing plan
  const resourcesWithActions = determineActions(resources, existingPlan);

  // Calculate execution order based on dependencies
  const executionOrder = calculateExecutionOrder(resourcesWithActions);

  // Generate summary
  const summary = {
    to_create: resourcesWithActions.filter((r) => r.action === "create").length,
    to_update: resourcesWithActions.filter((r) => r.action === "update").length,
    to_delete: resourcesWithActions.filter((r) => r.action === "delete").length,
    no_change: resourcesWithActions.filter((r) => r.action === "no-op").length,
  };

  return {
    version: "1.0.0",
    generated_at: new Date().toISOString(),
    infrastructure_tier: normalized.project?.infrastructure_tier || "production",
    resources: resourcesWithActions,
    execution_order: executionOrder,
    summary,
    validation_passed: true,
  };
}

/**
 * Generates datacenter layer resources
 */
function generateDatacenterResources(datacenter: Datacenter): PlanResource[] {
  const resources: PlanResource[] = [];

  // Proxmox servers
  datacenter.servers?.forEach((server) => {
    resources.push({
      id: `server.${server.name}`,
      type: "proxmox_server",
      layer: "datacenter",
      action: "create",
      data: server,
      dependencies: [],
      metadata: { checksum: generateChecksum(server) },
    });
  });

  // Backup servers
  datacenter.backup_servers?.forEach((server) => {
    resources.push({
      id: `backup.${server.name}`,
      type: "backup_server",
      layer: "datacenter",
      action: "create",
      data: server,
      dependencies: [],
      metadata: { checksum: generateChecksum(server) },
    });
  });

  // Storage backends
  if (datacenter.storage_backends) {
    Object.entries(datacenter.storage_backends).forEach(([name, config]) => {
      resources.push({
        id: `storage.${name}`,
        type: "storage_backend",
        layer: "datacenter",
        action: "create",
        data: { name, ...config },
        dependencies: [`backup.${config.server}`],
        metadata: { checksum: generateChecksum(config) },
      });
    });
  }

  return resources;
}

/**
 * Generates networking layer resources
 */
function generateNetworkingResources(networking: NetworkingConfig): PlanResource[] {
  const resources: PlanResource[] = [];

  // Public IP configuration
  if (networking.public_ip) {
    resources.push({
      id: "public_ip.config",
      type: "public_ip_config",
      layer: "networking",
      action: "create",
      data: networking.public_ip,
      dependencies: [],
      metadata: { checksum: generateChecksum(networking.public_ip) },
    });

    // VRRP failover
    if (networking.public_ip.failover) {
      resources.push({
        id: "public_ip.failover",
        type: "vrrp_failover",
        layer: "networking",
        action: "create",
        data: networking.public_ip.failover,
        dependencies: ["public_ip.config"],
        metadata: { checksum: generateChecksum(networking.public_ip.failover) },
      });
    }
  }

  // Firewall VMs
  if (networking.firewall?.enabled) {
    networking.firewall.vm_ids?.forEach((vmId) => {
      resources.push({
        id: `firewall.vm-${vmId}`,
        type: "firewall_vm",
        layer: "networking",
        action: "create",
        data: {
          vm_id: vmId,
          type: networking.firewall!.type,
          public_ip: networking.firewall!.public_ip,
        },
        dependencies: ["public_ip.config"],
        metadata: { checksum: generateChecksum({ vmId, firewall: networking.firewall }) },
      });
    });
  }

  // VPN servers
  if (networking.vpn?.enabled) {
    networking.vpn.vm_ids?.forEach((vmId) => {
      resources.push({
        id: `vpn.server-${vmId}`,
        type: "vpn_server",
        layer: "networking",
        action: "create",
        data: {
          vm_id: vmId,
          type: networking.vpn!.type,
          public_ip: networking.vpn!.public_ip,
          vpn_subnet: networking.vpn!.vpn_subnet,
        },
        dependencies: ["public_ip.config"],
        metadata: { checksum: generateChecksum({ vmId, vpn: networking.vpn }) },
      });
    });
  }

  // DNS zones
  if (networking.dns) {
    // PowerDNS servers
    networking.dns.powerdns?.vm_ids?.forEach((vmId) => {
      resources.push({
        id: `dns.powerdns-${vmId}`,
        type: "powerdns_server",
        layer: "networking",
        action: "create",
        data: { vm_id: vmId, database: networking.dns!.powerdns?.database },
        dependencies: [],
        metadata: { checksum: generateChecksum({ vmId, dns: networking.dns!.powerdns }) },
      });
    });

    // DNS zones
    networking.dns.zones?.forEach((zone) => {
      resources.push({
        id: `dns.zone-${zone.domain}`,
        type: "dns_zone",
        layer: "networking",
        action: "create",
        data: zone,
        dependencies: [],
        metadata: { checksum: generateChecksum(zone) },
      });
    });
  }

  return resources;
}

/**
 * Generates security layer resources
 */
function generateSecurityResources(security: SecurityConfig): PlanResource[] {
  const resources: PlanResource[] = [];

  // Vault
  if (security.vault?.enabled) {
    resources.push({
      id: "security.vault",
      type: "vault_server",
      layer: "security",
      action: "create",
      data: security.vault,
      dependencies: [],
      metadata: { checksum: generateChecksum(security.vault) },
    });
  }

  // SSO
  if (security.sso?.enabled) {
    resources.push({
      id: `security.sso-${security.sso.type}`,
      type: "sso_server",
      layer: "security",
      action: "create",
      data: security.sso,
      dependencies: [],
      metadata: { checksum: generateChecksum(security.sso) },
    });
  }

  return resources;
}

/**
 * Generates compute layer resources
 */
function generateComputeResources(compute: ComputeConfig): PlanResource[] {
  const resources: PlanResource[] = [];

  // Instance type definitions
  compute.instance_type_definitions?.forEach((typeDef) => {
    resources.push({
      id: `instance_type.${typeDef.name}`,
      type: "instance_type",
      layer: "compute",
      action: "create",
      data: typeDef,
      dependencies: [],
      metadata: { checksum: generateChecksum(typeDef) },
    });
  });

  // Virtual machines
  compute.virtual_machines?.forEach((vm) => {
    const dependencies = [`server.${vm.host}`];
    if ("type_definition" in vm) {
      dependencies.push(`instance_type.${vm.type_definition}`);
    }

    resources.push({
      id: `vm.${vm.name}`,
      type: "vm",
      layer: "compute",
      action: "create",
      data: vm,
      dependencies,
      metadata: { checksum: generateChecksum(vm) },
    });
  });

  // Linux containers
  compute.linux_containers?.forEach((container) => {
    resources.push({
      id: `lxc.${container.name}`,
      type: "lxc_container",
      layer: "compute",
      action: "create",
      data: container,
      dependencies: [`server.${container.host}`],
      metadata: { checksum: generateChecksum(container) },
    });
  });

  return resources;
}

/**
 * Generates database layer resources
 */
function generateDatabaseResources(database: DatabasesLayer): PlanResource[] {
  const resources: PlanResource[] = [];

  database.clusters?.forEach((cluster) => {
    // Database cluster - use top-level name for resource ID
    resources.push({
      id: `db_cluster.${cluster.name}`,
      type: "database_cluster",
      layer: "database",
      action: "create",
      data: cluster,
      dependencies: cluster.cluster.vm_ids.map((id) => `vm.postgres-${id}`),
      metadata: { checksum: generateChecksum(cluster) },
    });

    // Individual databases
    cluster.databases?.forEach((db) => {
      resources.push({
        id: `database.${cluster.name}.${db.name}`,
        type: "database",
        layer: "database",
        action: "create",
        data: db,
        dependencies: [`db_cluster.${cluster.name}`],
        metadata: { checksum: generateChecksum(db) },
      });
    });
  });

  return resources;
}

/**
 * Generates K8s layer resources
 */
function generateK8sResources(k8s: K8sCluster): PlanResource[] {
  const resources: PlanResource[] = [];

  // Master nodes
  k8s.master_nodes?.forEach((node) => {
    resources.push({
      id: `k8s_master.${node.name}`,
      type: "k8s_master",
      layer: "k8s",
      action: "create",
      data: node,
      dependencies: [],
      metadata: { checksum: generateChecksum(node) },
    });
  });

  // Worker nodes
  k8s.worker_nodes?.forEach((node) => {
    resources.push({
      id: `k8s_worker.${node.name}`,
      type: "k8s_worker",
      layer: "k8s",
      action: "create",
      data: node,
      dependencies: k8s.master_nodes?.map((m) => `k8s_master.${m.name}`) || [],
      metadata: { checksum: generateChecksum(node) },
    });
  });

  // HAProxy nodes
  k8s.ha_proxy_nodes?.forEach((node) => {
    resources.push({
      id: `haproxy.${node.name}`,
      type: "haproxy",
      layer: "k8s",
      action: "create",
      data: node,
      dependencies: [],
      metadata: { checksum: generateChecksum(node) },
    });
  });

  // K8s network
  if (k8s.network) {
    resources.push({
      id: `k8s_network.${k8s.name}`,
      type: "k8s_network",
      layer: "k8s",
      action: "create",
      data: k8s.network,
      dependencies: k8s.master_nodes?.map((m) => `k8s_master.${m.name}`) || [],
      metadata: { checksum: generateChecksum(k8s.network) },
    });
  }

  // Ingress controller
  if (k8s.ingress) {
    resources.push({
      id: `ingress.${k8s.name}`,
      type: "ingress_controller",
      layer: "k8s",
      action: "create",
      data: k8s.ingress,
      dependencies: [`k8s_network.${k8s.name}`],
      metadata: { checksum: generateChecksum(k8s.ingress) },
    });
  }

  // MetalLB
  if (k8s.metallb?.enabled) {
    resources.push({
      id: `metallb.${k8s.name}`,
      type: "metallb_pool",
      layer: "k8s",
      action: "create",
      data: k8s.metallb,
      dependencies: [`k8s_network.${k8s.name}`],
      metadata: { checksum: generateChecksum(k8s.metallb) },
    });
  }

  return resources;
}

/**
 * Generates apps layer resources
 */
function generateAppsResources(apps: AppsConfig): PlanResource[] {
  const resources: PlanResource[] = [];

  Object.entries(apps).forEach(([appName, appConfig]) => {
    if (appConfig?.enabled) {
      resources.push({
        id: `app.${appName}`,
        type: "app",
        layer: "apps",
        action: "create",
        data: appConfig,
        dependencies: [],
        metadata: { checksum: generateChecksum(appConfig) },
      });
    }
  });

  return resources;
}

/**
 * Determines actions for resources by comparing with existing plan
 */
function determineActions(
  resources: PlanResource[],
  existingPlan?: InfrastructurePlan
): PlanResource[] {
  if (!existingPlan) {
    return resources.map((r) => ({ ...r, action: "create" as ResourceAction }));
  }

  const existingResources = new Map(existingPlan.resources.map((r) => [r.id, r]));
  const result: PlanResource[] = [];

  resources.forEach((resource) => {
    const existing = existingResources.get(resource.id);

    if (!existing) {
      result.push({ ...resource, action: "create" });
    } else if (existing.metadata.checksum !== resource.metadata.checksum) {
      result.push({ ...resource, action: "update" });
    } else {
      result.push({ ...resource, action: "no-op" });
    }

    existingResources.delete(resource.id);
  });

  // Remaining resources should be deleted
  existingResources.forEach((resource) => {
    result.push({ ...resource, action: "delete" });
  });

  return result;
}

/**
 * Calculates execution order based on resource dependencies
 */
function calculateExecutionOrder(resources: PlanResource[]): string[][] {
  const order: string[][] = [];
  const resourceMap = new Map(resources.map((r) => [r.id, r]));

  function getExecutionLevel(resourceId: string, visited = new Set<string>()): number {
    if (visited.has(resourceId)) {
      throw new Error(`Circular dependency detected: ${Array.from(visited).join(" -> ")} -> ${resourceId}`);
    }

    const resource = resourceMap.get(resourceId);
    if (!resource) return -1;

    if (resource.dependencies.length === 0) {
      return 0;
    }

    visited.add(resourceId);
    let maxDependencyLevel = -1;

    for (const depId of resource.dependencies) {
      const depLevel = getExecutionLevel(depId, new Set(visited));
      maxDependencyLevel = Math.max(maxDependencyLevel, depLevel);
    }

    return maxDependencyLevel + 1;
  }

  // Calculate level for each resource
  const resourceLevels = new Map<string, number>();

  resources.forEach((resource) => {
    if (resource.action !== "delete") {
      try {
        const level = getExecutionLevel(resource.id);
        resourceLevels.set(resource.id, level);
      } catch {
        resourceLevels.set(resource.id, 0);
      }
    }
  });

  // Group resources by level
  const maxLevel = Math.max(0, ...Array.from(resourceLevels.values()));

  for (let level = 0; level <= maxLevel; level++) {
    const group = Array.from(resourceLevels.entries())
      .filter(([_, l]) => l === level)
      .map(([id, _]) => id);

    if (group.length > 0) {
      order.push(group);
    }
  }

  // Handle deletions (at the end)
  const deletions = resources.filter((r) => r.action === "delete").map((r) => r.id);

  if (deletions.length > 0) {
    order.push(deletions);
  }

  return order;
}

/**
 * Generates a checksum for a configuration object
 */
function generateChecksum(data: any): string {
  const crypto = require("crypto");
  const jsonString = JSON.stringify(data, Object.keys(data || {}).sort());
  return crypto.createHash("sha256").update(jsonString).digest("hex");
}

/**
 * Saves plan to a file
 */
export function savePlan(plan: InfrastructurePlan, outputPath: string): void {
  const fs = require("fs");
  const yaml = require("js-yaml");

  const yamlContent = yaml.dump(plan, {
    indent: 2,
    lineWidth: 120,
    noRefs: true,
  });

  fs.writeFileSync(outputPath, yamlContent, "utf8");
}

/**
 * Loads plan from a file
 */
export function loadPlan(planPath: string): InfrastructurePlan | null {
  const fs = require("fs");
  const yaml = require("js-yaml");

  try {
    const content = fs.readFileSync(planPath, "utf8");
    return yaml.load(content) as InfrastructurePlan;
  } catch {
    return null;
  }
}
