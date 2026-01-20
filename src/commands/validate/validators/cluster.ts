import { InfrastructureTierType, K8sCluster } from "../../../types";
import { ValidationResult, ValidationContext, addError, addWarning } from "../utils/types";
import {
  validateMinimumNodes,
  validateOddNodeCount,
  validateHostDistribution,
} from "../rules/ha-requirements";
import { validateCidrFormat } from "../rules/security";

/**
 * Validates Kubernetes cluster configuration
 */
export function validateCluster(
  cluster: K8sCluster,
  context: ValidationContext,
  result: ValidationResult,
  infrastructureTier: InfrastructureTierType
): void {
  const layer = "cluster";

  // Validate cluster name
  if (!cluster.name) {
    addError(result, layer, "name", "Cluster name is required", "error");
  } else {
    // Check for duplicate cluster names
    if (context.cluster_names.has(cluster.name)) {
      addError(result, layer, "name", `Duplicate cluster name: ${cluster.name}`, "error");
    } else {
      context.cluster_names.add(cluster.name);
    }
  }

  // Validate master nodes
  if (!cluster.master_nodes || cluster.master_nodes.length === 0) {
    addError(
      result,
      layer,
      "master_nodes",
      "At least one master node is required",
      "critical",
      "Add master nodes to create a functional Kubernetes cluster"
    );
  } else {
    // HA requirement: minimum 3 masters for Etcd quorum
    validateMinimumNodes(
      cluster.master_nodes,
      3,
      "Kubernetes masters (Etcd quorum)",
      result,
      layer,
      "master_nodes",
      infrastructureTier
    );

    // Warn if even number
    validateOddNodeCount(
      cluster.master_nodes.length,
      "Kubernetes masters",
      result,
      layer,
      "master_nodes",
      infrastructureTier
    );

    // Validate host distribution
    validateHostDistribution(
      cluster.master_nodes,
      "Kubernetes master",
      result,
      layer,
      "master_nodes",
      infrastructureTier
    );

    // Validate each master node
    cluster.master_nodes.forEach((node, index) => {
      const nodeField = `master_nodes[${index}]`;

      if (!node.name) {
        addError(result, layer, `${nodeField}.name`, "Node name is required", "error");
      } else {
        // Check if VM exists in context
        if (!context.vm_ids_used.has(node.vm_id)) {
          addWarning(
            result,
            layer,
            `${nodeField}.name`,
            `Master node "${node.name}" (VM ID: ${node.vm_id}) not found in compute configuration`,
            "Ensure this VM is defined in the compute layer"
          );
        }
      }

      if (!node.vm_id) {
        addError(result, layer, `${nodeField}.vm_id`, "VM ID is required", "error");
      }
    });
  }

  // Validate worker nodes
  if (!cluster.worker_nodes || cluster.worker_nodes.length === 0) {
    addWarning(
      result,
      layer,
      "worker_nodes",
      "No worker nodes configured",
      "Add worker nodes to run application workloads"
    );
  } else {
    // Validate host distribution
    validateHostDistribution(
      cluster.worker_nodes,
      "Kubernetes worker",
      result,
      layer,
      "worker_nodes",
      infrastructureTier
    );

    // Validate each worker node
    cluster.worker_nodes.forEach((node, index) => {
      const nodeField = `worker_nodes[${index}]`;

      if (!node.name) {
        addError(result, layer, `${nodeField}.name`, "Node name is required", "error");
      } else {
        // Check if VM exists in context
        if (!context.vm_ids_used.has(node.vm_id)) {
          addWarning(
            result,
            layer,
            `${nodeField}.name`,
            `Worker node "${node.name}" (VM ID: ${node.vm_id}) not found in compute configuration`,
            "Ensure this VM is defined in the compute layer"
          );
        }
      }

      if (!node.vm_id) {
        addError(result, layer, `${nodeField}.vm_id`, "VM ID is required", "error");
      }
    });
  }

  // Validate HAProxy nodes
  if (cluster.ha_proxy_nodes && cluster.ha_proxy_nodes.length > 0) {
    // HA requirement: at least 2 HAProxy nodes
    if (cluster.ha_proxy_nodes.length < 2) {
      addWarning(
        result,
        layer,
        "ha_proxy_nodes",
        "Only 1 HAProxy node configured - no HA for Kubernetes API",
        "Add at least 2 HAProxy nodes for redundancy"
      );
    }

    // Validate host distribution
    validateHostDistribution(cluster.ha_proxy_nodes, "HAProxy", result, layer, "ha_proxy_nodes", infrastructureTier);

    // Validate each HAProxy node
    cluster.ha_proxy_nodes.forEach((node, index) => {
      const nodeField = `ha_proxy_nodes[${index}]`;

      if (!node.name) {
        addError(result, layer, `${nodeField}.name`, "Node name is required", "error");
      }

      if (!node.vm_id) {
        addError(result, layer, `${nodeField}.vm_id`, "VM ID is required", "error");
      } else {
        // Validate VM ID range (400-449 for load balancers)
        if (node.vm_id < 400 || node.vm_id > 449) {
          addError(
            result,
            layer,
            `${nodeField}.vm_id`,
            `HAProxy VM ID ${node.vm_id} must be in range 400-449`,
            "error"
          );
        }
      }
    });
  } else {
    addWarning(
      result,
      layer,
      "ha_proxy_nodes",
      "No HAProxy nodes configured - single point of failure for Kubernetes API",
      "Add HAProxy nodes for load balancing and HA of the Kubernetes API server"
    );
  }

  // Validate ingress configuration
  if (cluster.ingress) {
    if (!["traefik", "nginx"].includes(cluster.ingress.type)) {
      addError(
        result,
        layer,
        "ingress.type",
        `Invalid ingress type: ${cluster.ingress.type}`,
        "error",
        'Must be one of: "traefik", "nginx"'
      );
    }

    // HA requirement for ingress replicas
    if (infrastructureTier !== "local" && cluster.ingress.replicas < 2) {
      addError(
        result,
        layer,
        "ingress.replicas",
        `Ingress requires at least 2 replicas for HA in ${infrastructureTier} tier`,
        "error",
        "Set replicas: 2 or higher for high availability"
      );
    } else if (cluster.ingress.replicas < 1) {
      addError(result, layer, "ingress.replicas", "Ingress requires at least 1 replica", "error");
    }
  } else {
    addWarning(
      result,
      layer,
      "ingress",
      "No ingress controller configured",
      "Add ingress configuration to expose services externally"
    );
  }

  // Validate public_ip configuration for ingress
  if (cluster.public_ip) {
    if (!cluster.public_ip.ip) {
      addWarning(
        result,
        layer,
        "public_ip.ip",
        "Public IP not set for cluster ingress",
        "Set a public IP from your allocated block for external access"
      );
    }

    if (cluster.public_ip.vrrp_id !== undefined) {
      if (cluster.public_ip.vrrp_id < 1 || cluster.public_ip.vrrp_id > 255) {
        addError(
          result,
          layer,
          "public_ip.vrrp_id",
          `VRRP ID ${cluster.public_ip.vrrp_id} must be between 1 and 255`,
          "error"
        );
      }
    }
  }

  // Validate MetalLB configuration
  if (cluster.metallb?.enabled) {
    if (cluster.metallb.mode !== "layer2") {
      addError(
        result,
        layer,
        "metallb.mode",
        `Invalid MetalLB mode: ${cluster.metallb.mode}`,
        "error",
        'Currently only "layer2" is supported'
      );
    }

    if (!cluster.metallb.address_pool) {
      addError(
        result,
        layer,
        "metallb.address_pool",
        "MetalLB address pool is required when enabled",
        "error",
        'Set address_pool to an IP range (e.g., "203.0.113.100-203.0.113.200")'
      );
    }
  }

  // Validate network configuration
  if (!cluster.network) {
    addError(result, layer, "network", "Network configuration is required", "critical");
    return;
  }

  // Validate pod CIDR
  if (!cluster.network.pod_cidr) {
    addError(
      result,
      layer,
      "network.pod_cidr",
      "Pod CIDR is required",
      "critical",
      'Add pod_cidr (e.g., "10.244.0.0/16")'
    );
  } else {
    validateCidrFormat(cluster.network.pod_cidr, "network.pod_cidr", result, layer);
  }

  // Validate service CIDR
  if (!cluster.network.service_cidr) {
    addError(
      result,
      layer,
      "network.service_cidr",
      "Service CIDR is required",
      "critical",
      'Add service_cidr (e.g., "10.96.0.0/12")'
    );
  } else {
    validateCidrFormat(cluster.network.service_cidr, "network.service_cidr", result, layer);
  }

  // Validate CNI
  if (!cluster.network.cni) {
    addWarning(
      result,
      layer,
      "network.cni",
      "CNI not specified - will default to calico",
      'Explicitly set cni: "cilium" or "calico"'
    );
  } else if (!["cilium", "calico", "weave", "flannel"].includes(cluster.network.cni)) {
    addError(
      result,
      layer,
      "network.cni",
      `Invalid CNI: ${cluster.network.cni}`,
      "error",
      'Must be one of: "cilium", "calico", "weave", "flannel"'
    );
  }

  // Validate Cilium features
  if (cluster.network.cni === "cilium" && cluster.network.cilium_features) {
    if (
      cluster.network.cilium_features.cluster_mesh &&
      !cluster.network.cilium_features.ebpf_enabled
    ) {
      addWarning(
        result,
        layer,
        "network.cilium_features.ebpf_enabled",
        "ClusterMesh works best with eBPF enabled",
        "Set ebpf_enabled: true for optimal ClusterMesh performance"
      );
    }
  }

  // Validate auto-scaling configuration
  if (cluster.auto_scaling?.enabled) {
    if (!cluster.auto_scaling.providers || cluster.auto_scaling.providers.length === 0) {
      addError(
        result,
        layer,
        "auto_scaling.providers",
        "Auto-scaling enabled but no providers configured",
        "error",
        "Add at least one provider (onprem or public_cloud)"
      );
    } else {
      const priorities = new Set<number>();

      cluster.auto_scaling.providers.forEach((provider, index) => {
        const providerField = `auto_scaling.providers[${index}]`;

        // Validate priority uniqueness
        if (priorities.has(provider.priority)) {
          addError(
            result,
            layer,
            `${providerField}.priority`,
            `Duplicate priority: ${provider.priority}`,
            "error",
            "Each provider must have a unique priority"
          );
        } else {
          priorities.add(provider.priority);
        }

        // Validate public_cloud requirements
        if (provider.type === "public_cloud") {
          if (!provider.region) {
            addError(
              result,
              layer,
              `${providerField}.region`,
              "Region is required for public_cloud providers",
              "error",
              'Add region (e.g., "us-east-1" for AWS)'
            );
          }

          if (!provider.credentials) {
            addError(
              result,
              layer,
              `${providerField}.credentials`,
              "Credentials are required for public_cloud providers",
              "critical",
              "Configure credentials using vault_path or environment variables"
            );
          }
        }
      });
    }
  }
}
