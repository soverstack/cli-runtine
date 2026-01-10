import { NormalizedInfrastructure } from "./normalizer";

/**
 * Represents an infrastructure resource in the plan
 */
export interface PlanResource {
  id: string; // Unique identifier (e.g., "server.node1", "vm.k8s-master-1")
  type: ResourceType;
  layer: LayerType;
  action: ResourceAction;
  data: any; // The actual resource configuration
  dependencies: string[]; // IDs of resources this depends on
  metadata: {
    created_at?: string;
    updated_at?: string;
    checksum?: string; // Hash of configuration for change detection
  };
}

/**
 * Types of infrastructure resources
 */
export type ResourceType =
  // Datacenter layer
  | "proxmox_server"
  | "ceph_server"
  | "network_bridge"
  | "failover_ip"

  // Firewall layer
  | "firewall_vm"
  | "firewall_rule"

  // Bastion layer
  | "bastion_vm"
  | "vpn_subnet"

  // Compute layer
  | "vm"
  | "lxc_container"
  | "instance_type"

  // Cluster layer
  | "k8s_master"
  | "k8s_worker"
  | "haproxy"
  | "k8s_network"

  // Features layer
  | "feature";

/**
 * Actions to perform on resources
 */
export type ResourceAction = "create" | "update" | "delete" | "no-op";

/**
 * Layer types
 */
export type LayerType = "datacenter" | "firewall" | "bastion" | "compute" | "cluster" | "features";

/**
 * Complete infrastructure plan
 */
export interface InfrastructurePlan {
  version: string;
  generated_at: string;
  infrastructure_tier: "local" | "production" | "enterprise";
  environment?: string;

  resources: PlanResource[];

  execution_order: string[][]; // Array of resource ID groups (parallel execution within group)

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

  if (normalized.firewall) {
    resources.push(...generateFirewallResources(normalized.firewall));
  }

  if (normalized.bastion) {
    resources.push(...generateBastionResources(normalized.bastion));
  }

  if (normalized.compute) {
    resources.push(...generateComputeResources(normalized.compute));
  }

  if (normalized.cluster) {
    resources.push(...generateClusterResources(normalized.cluster));
  }

  if (normalized.features) {
    resources.push(...generateFeatureResources(normalized.features));
  }

  // Determine actions (create/update/delete) by comparing with existing plan
  const resourcesWithActions = determineActions(resources, existingPlan);

  // Calculate execution order based on dependencies
  const executionOrder = calculateExecutionOrder(resourcesWithActions);

  // Generate summary
  const summary = {
    to_create: resourcesWithActions.filter(r => r.action === "create").length,
    to_update: resourcesWithActions.filter(r => r.action === "update").length,
    to_delete: resourcesWithActions.filter(r => r.action === "delete").length,
    no_change: resourcesWithActions.filter(r => r.action === "no-op").length,
  };

  return {
    version: "1.0.0",
    generated_at: new Date().toISOString(),
    infrastructure_tier: normalized.project?.infrastructure_tier || "production",
    environment: normalized.project?.environment,
    resources: resourcesWithActions,
    execution_order: executionOrder,
    summary,
    validation_passed: true, // Set by validate command
  };
}

/**
 * Generates datacenter layer resources
 */
function generateDatacenterResources(datacenter: any): PlanResource[] {
  const resources: PlanResource[] = [];

  // Proxmox servers
  datacenter.servers?.forEach((server: any, index: number) => {
    resources.push({
      id: `server.${server.name}`,
      type: "proxmox_server",
      layer: "datacenter",
      action: "create", // Will be determined later
      data: server,
      dependencies: [],
      metadata: {
        checksum: generateChecksum(server),
      },
    });
  });

  // Ceph servers
  if (datacenter.ceph?.enabled && datacenter.ceph.servers) {
    datacenter.ceph.servers.forEach((serverName: string) => {
      resources.push({
        id: `ceph.${serverName}`,
        type: "ceph_server",
        layer: "datacenter",
        action: "create",
        data: { server_name: serverName, ceph_config: datacenter.ceph },
        dependencies: [`server.${serverName}`],
        metadata: {
          checksum: generateChecksum(datacenter.ceph),
        },
      });
    });
  }

  // Network configuration
  if (datacenter.network) {
    resources.push({
      id: `network.main`,
      type: "network_bridge",
      layer: "datacenter",
      action: "create",
      data: datacenter.network,
      dependencies: [],
      metadata: {
        checksum: generateChecksum(datacenter.network),
      },
    });
  }

  return resources;
}

/**
 * Generates firewall layer resources
 */
function generateFirewallResources(firewall: any): PlanResource[] {
  const resources: PlanResource[] = [];

  if (!firewall.enabled) return resources;

  firewall.vm_configuration?.vm_ids?.forEach((vmId: number, index: number) => {
    resources.push({
      id: `firewall.vm-${vmId}`,
      type: "firewall_vm",
      layer: "firewall",
      action: "create",
      data: {
        vm_id: vmId,
        type: firewall.type,
        public_ip: firewall.public_ip,
        config: firewall.vm_configuration,
      },
      dependencies: ["network.main"],
      metadata: {
        checksum: generateChecksum({ vmId, firewall }),
      },
    });
  });

  return resources;
}

/**
 * Generates bastion layer resources
 */
function generateBastionResources(bastion: any): PlanResource[] {
  const resources: PlanResource[] = [];

  if (!bastion.enabled) return resources;

  bastion.vm_configuration?.vm_ids?.forEach((vmId: number, index: number) => {
    resources.push({
      id: `bastion.vm-${vmId}`,
      type: "bastion_vm",
      layer: "bastion",
      action: "create",
      data: {
        vm_id: vmId,
        type: bastion.type,
        public_ip: bastion.public_ip,
        config: bastion.vm_configuration,
        vpn_subnet: bastion.vpn_subnet,
      },
      dependencies: ["network.main"],
      metadata: {
        checksum: generateChecksum({ vmId, bastion }),
      },
    });
  });

  return resources;
}

/**
 * Generates compute layer resources
 */
function generateComputeResources(compute: any): PlanResource[] {
  const resources: PlanResource[] = [];

  // Instance type definitions
  compute.instance_type_definitions?.forEach((typeDef: any) => {
    resources.push({
      id: `instance_type.${typeDef.name}`,
      type: "instance_type",
      layer: "compute",
      action: "create",
      data: typeDef,
      dependencies: [],
      metadata: {
        checksum: generateChecksum(typeDef),
      },
    });
  });

  // Virtual machines
  compute.virtual_machines?.forEach((vm: any) => {
    const dependencies = [`server.${vm.host}`];

    // Add instance type dependency if using type definition
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
      metadata: {
        checksum: generateChecksum(vm),
      },
    });
  });

  // Linux containers
  compute.linux_containers?.forEach((container: any) => {
    resources.push({
      id: `lxc.${container.name}`,
      type: "lxc_container",
      layer: "compute",
      action: "create",
      data: container,
      dependencies: [`server.${container.host}`],
      metadata: {
        checksum: generateChecksum(container),
      },
    });
  });

  return resources;
}

/**
 * Generates cluster layer resources
 */
function generateClusterResources(cluster: any): PlanResource[] {
  const resources: PlanResource[] = [];

  // Master nodes
  cluster.master_nodes?.forEach((node: any) => {
    resources.push({
      id: `k8s_master.${node.name}`,
      type: "k8s_master",
      layer: "cluster",
      action: "create",
      data: node,
      dependencies: [`vm.${node.name}`],
      metadata: {
        checksum: generateChecksum(node),
      },
    });
  });

  // Worker nodes
  cluster.worker_nodes?.forEach((node: any) => {
    resources.push({
      id: `k8s_worker.${node.name}`,
      type: "k8s_worker",
      layer: "cluster",
      action: "create",
      data: node,
      dependencies: [`vm.${node.name}`, ...cluster.master_nodes.map((m: any) => `k8s_master.${m.name}`)],
      metadata: {
        checksum: generateChecksum(node),
      },
    });
  });

  // HAProxy nodes
  cluster.ha_proxy_nodes?.forEach((node: any) => {
    resources.push({
      id: `haproxy.${node.name}`,
      type: "haproxy",
      layer: "cluster",
      action: "create",
      data: node,
      dependencies: [`vm.${node.name}`],
      metadata: {
        checksum: generateChecksum(node),
      },
    });
  });

  // K8s network
  if (cluster.network) {
    resources.push({
      id: `k8s_network.${cluster.name}`,
      type: "k8s_network",
      layer: "cluster",
      action: "create",
      data: cluster.network,
      dependencies: cluster.master_nodes?.map((m: any) => `k8s_master.${m.name}`) || [],
      metadata: {
        checksum: generateChecksum(cluster.network),
      },
    });
  }

  return resources;
}

/**
 * Generates features layer resources
 */
function generateFeatureResources(features: any): PlanResource[] {
  const resources: PlanResource[] = [];

  // Add feature resources (Traefik, SSO, etc.)
  Object.entries(features).forEach(([featureName, featureConfig]: [string, any]) => {
    if (featureConfig?.enabled) {
      resources.push({
        id: `feature.${featureName}`,
        type: "feature",
        layer: "features",
        action: "create",
        data: featureConfig,
        dependencies: [], // Features typically depend on cluster being ready
        metadata: {
          checksum: generateChecksum(featureConfig),
        },
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
    // No existing plan, all resources are new
    return resources.map(r => ({ ...r, action: "create" as ResourceAction }));
  }

  const existingResources = new Map(
    existingPlan.resources.map(r => [r.id, r])
  );

  const result: PlanResource[] = [];

  // Check each resource
  resources.forEach(resource => {
    const existing = existingResources.get(resource.id);

    if (!existing) {
      // New resource
      result.push({ ...resource, action: "create" });
    } else if (existing.metadata.checksum !== resource.metadata.checksum) {
      // Resource changed
      result.push({ ...resource, action: "update" });
    } else {
      // No change
      result.push({ ...resource, action: "no-op" });
    }

    // Remove from existing map (for deletion detection)
    existingResources.delete(resource.id);
  });

  // Remaining resources in existing plan should be deleted
  existingResources.forEach(resource => {
    result.push({ ...resource, action: "delete" });
  });

  return result;
}

/**
 * Calculates execution order based on resource dependencies
 * Returns array of groups where resources in each group can be executed in parallel
 */
function calculateExecutionOrder(resources: PlanResource[]): string[][] {
  const order: string[][] = [];
  const processed = new Set<string>();
  const resourceMap = new Map(resources.map(r => [r.id, r]));

  // Helper function to get execution level
  function getExecutionLevel(resourceId: string, visited = new Set<string>()): number {
    if (processed.has(resourceId)) {
      return -1; // Already processed
    }

    if (visited.has(resourceId)) {
      throw new Error(`Circular dependency detected: ${Array.from(visited).join(" -> ")} -> ${resourceId}`);
    }

    const resource = resourceMap.get(resourceId);
    if (!resource) return -1;

    // Resource with no dependencies goes to level 0
    if (resource.dependencies.length === 0) {
      return 0;
    }

    // Find max level of dependencies
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

  resources.forEach(resource => {
    if (resource.action !== "delete") {
      const level = getExecutionLevel(resource.id);
      resourceLevels.set(resource.id, level);
    }
  });

  // Group resources by level
  const maxLevel = Math.max(...Array.from(resourceLevels.values()));

  for (let level = 0; level <= maxLevel; level++) {
    const group = Array.from(resourceLevels.entries())
      .filter(([_, l]) => l === level)
      .map(([id, _]) => id);

    if (group.length > 0) {
      order.push(group);
    }
  }

  // Handle deletions (reverse order)
  const deletions = resources
    .filter(r => r.action === "delete")
    .map(r => r.id);

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
  const jsonString = JSON.stringify(data, Object.keys(data).sort());
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
  } catch (error) {
    return null;
  }
}
