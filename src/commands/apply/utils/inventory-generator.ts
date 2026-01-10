import fs from "fs";
import path from "path";
import yaml from "js-yaml";
import { NormalizedInfrastructure } from "../../validate/utils/normalizer";
import { InfrastructurePlan } from "../../validate/utils/plan-generator";

/**
 * Ansible Inventory structure
 */
export interface AnsibleInventory {
  all: {
    hosts?: Record<string, any>;
    children: Record<string, InventoryGroup>;
    vars?: Record<string, any>;
  };
}

interface InventoryGroup {
  hosts?: Record<string, any>;
  vars?: Record<string, any>;
  children?: Record<string, InventoryGroup>;
}

/**
 * Generates Ansible inventory from infrastructure configuration
 */
export function generateAnsibleInventory(
  normalized: NormalizedInfrastructure,
  plan: InfrastructurePlan,
  envVars: Map<string, string>
): AnsibleInventory {
  const inventory: AnsibleInventory = {
    all: {
      children: {},
      vars: {
        ansible_user: "{{ ssh_user }}",
        ansible_ssh_private_key_file: "{{ ssh_private_key_path }}",
        ansible_python_interpreter: "/usr/bin/python3",
        infrastructure_tier: normalized.project?.infrastructure_tier || "production",
        environment: normalized.project?.environment || "prod",
        domain: normalized.project?.domain,
      },
    },
  };

  // Add Proxmox servers group
  if (normalized.datacenter?.servers) {
    inventory.all.children.proxmox_servers = generateProxmoxGroup(
      normalized.datacenter.servers,
      envVars
    );
  }

  // Add Firewall group
  if (normalized.firewall?.enabled && normalized.firewall.vm_configuration?.vm_ids) {
    inventory.all.children.firewalls = generateFirewallGroup(normalized.firewall);
  }

  // Add Bastion group
  if (normalized.bastion?.enabled && normalized.bastion.vm_configuration?.vm_ids) {
    inventory.all.children.bastions = generateBastionGroup(normalized.bastion);
  }

  // Add Kubernetes groups
  if (normalized.cluster) {
    const k8sGroups = generateK8sGroups(normalized.cluster);
    Object.assign(inventory.all.children, k8sGroups);
  }

  return inventory;
}

/**
 * Generates Proxmox servers group
 */
function generateProxmoxGroup(servers: any[], envVars: Map<string, string>): InventoryGroup {
  const hosts: Record<string, any> = {};

  servers.forEach((server) => {
    hosts[server.name] = {
      ansible_host: server.ip,
      ansible_port: server.port || 22,
      server_id: server.id,
      is_gpu_server: server.is_gpu_server || false,
      os: server.os,
      // SECURITY: Never include passwords in inventory
      // Passwords are loaded from env vars at runtime
    };
  });

  return {
    hosts,
    vars: {
      ansible_connection: "ssh",
      server_role: "proxmox",
    },
  };
}

/**
 * Generates Firewall group
 */
function generateFirewallGroup(firewall: any): InventoryGroup {
  const hosts: Record<string, any> = {};

  firewall.vm_configuration.vm_ids.forEach((vmId: number, index: number) => {
    const hostname = `firewall-${index + 1}`;
    hosts[hostname] = {
      vm_id: vmId,
      firewall_type: firewall.type,
      public_ip: firewall.public_ip,
      os_template: firewall.vm_configuration.os_template,
    };
  });

  return {
    hosts,
    vars: {
      firewall_enabled: true,
      firewall_type: firewall.type,
    },
  };
}

/**
 * Generates Bastion group
 */
function generateBastionGroup(bastion: any): InventoryGroup {
  const hosts: Record<string, any> = {};

  bastion.vm_configuration.vm_ids.forEach((vmId: number, index: number) => {
    const hostname = `bastion-${index + 1}`;
    hosts[hostname] = {
      vm_id: vmId,
      bastion_type: bastion.type,
      public_ip: bastion.public_ip,
      vpn_subnet: bastion.vpn_subnet,
      database_type: bastion.database_type,
      os_template: bastion.vm_configuration.os_template,
    };
  });

  return {
    hosts,
    vars: {
      bastion_enabled: true,
      bastion_type: bastion.type,
      oidc_enforced: true,
    },
  };
}

/**
 * Generates Kubernetes groups (masters, workers, haproxy)
 */
function generateK8sGroups(cluster: any): Record<string, InventoryGroup> {
  const groups: Record<string, InventoryGroup> = {};

  // K8s masters
  if (cluster.master_nodes && cluster.master_nodes.length > 0) {
    const masterHosts: Record<string, any> = {};

    cluster.master_nodes.forEach((node: any) => {
      masterHosts[node.name] = {
        vm_id: node.vm_id,
        host: node.host,
        role: "k8s_master",
      };
    });

    groups.k8s_masters = {
      hosts: masterHosts,
      vars: {
        k8s_role: "master",
        etcd_enabled: true,
      },
    };
  }

  // K8s workers
  if (cluster.worker_nodes && cluster.worker_nodes.length > 0) {
    const workerHosts: Record<string, any> = {};

    cluster.worker_nodes.forEach((node: any) => {
      workerHosts[node.name] = {
        vm_id: node.vm_id,
        host: node.host,
        role: "k8s_worker",
      };
    });

    groups.k8s_workers = {
      hosts: workerHosts,
      vars: {
        k8s_role: "worker",
      },
    };
  }

  // HAProxy
  if (cluster.ha_proxy_nodes && cluster.ha_proxy_nodes.length > 0) {
    const haproxyHosts: Record<string, any> = {};

    cluster.ha_proxy_nodes.forEach((node: any) => {
      haproxyHosts[node.name] = {
        vm_id: node.vm_id,
        host: node.host,
        role: "haproxy",
      };
    });

    groups.haproxy = {
      hosts: haproxyHosts,
      vars: {
        haproxy_enabled: true,
      },
    };
  }

  // K8s cluster parent group
  groups.kubernetes = {
    children: {
      k8s_masters: {},
      k8s_workers: {},
    },
    vars: {
      cluster_name: cluster.name,
      pod_cidr: cluster.network?.pod_cidr,
      service_cidr: cluster.network?.service_cidr,
      cni: cluster.network?.cni || "calico",
    },
  };

  return groups;
}

/**
 * Generates group_vars files
 */
export function generateGroupVars(
  normalized: NormalizedInfrastructure,
  outputDir: string
): void {
  const groupVarsDir = path.join(outputDir, "group_vars");

  if (!fs.existsSync(groupVarsDir)) {
    fs.mkdirSync(groupVarsDir, { recursive: true });
  }

  // Proxmox servers group vars
  if (normalized.datacenter) {
    const proxmoxVars = {
      // Network configuration
      network_type: normalized.datacenter.network?.type,
      failover_subnet: normalized.datacenter.network?.failover_subnet,

      // Ceph configuration
      ceph_enabled: normalized.datacenter.ceph?.enabled || false,
      ceph_public_network: normalized.datacenter.ceph?.public_network,
      ceph_private_network: normalized.datacenter.ceph?.private_network,

      // Cluster configuration
      cluster_private_network: normalized.datacenter.cluster?.private_network,
      cluster_public_network: normalized.datacenter.cluster?.public_network,

      // Alerting
      admin_email: normalized.datacenter.alert?.admin_email,

      // SECURITY: Passwords are loaded from env vars
      // Use Ansible vault or env vars at runtime
    };

    fs.writeFileSync(
      path.join(groupVarsDir, "proxmox_servers.yaml"),
      yaml.dump(proxmoxVars, { indent: 2 })
    );
  }

  // Kubernetes masters group vars
  if (normalized.cluster?.master_nodes) {
    const k8sMastersVars = {
      k8s_version: "1.28.0", // Should come from config
      etcd_data_dir: "/var/lib/etcd",
      kube_apiserver_port: 6443,

      // SECURITY: No secrets here
    };

    fs.writeFileSync(
      path.join(groupVarsDir, "k8s_masters.yaml"),
      yaml.dump(k8sMastersVars, { indent: 2 })
    );
  }

  // Kubernetes workers group vars
  if (normalized.cluster?.worker_nodes) {
    const k8sWorkersVars = {
      kubelet_max_pods: 110,
      kube_proxy_mode: "iptables",
    };

    fs.writeFileSync(
      path.join(groupVarsDir, "k8s_workers.yaml"),
      yaml.dump(k8sWorkersVars, { indent: 2 })
    );
  }
}

/**
 * Generates host_vars files
 */
export function generateHostVars(
  normalized: NormalizedInfrastructure,
  outputDir: string,
  envVars: Map<string, string>
): void {
  const hostVarsDir = path.join(outputDir, "host_vars");

  if (!fs.existsSync(hostVarsDir)) {
    fs.mkdirSync(hostVarsDir, { recursive: true });
  }

  // Generate host vars for each Proxmox server
  if (normalized.datacenter?.servers) {
    normalized.datacenter.servers.forEach((server) => {
      const hostVars = {
        ansible_host: server.ip,
        ansible_port: server.port || 22,
        server_id: server.id,
        os: server.os,
        is_gpu_server: server.is_gpu_server || false,

        // Disk encryption (if enabled)
        disk_encryption_enabled: server.disk_encryption?.enabled || false,

        // SECURITY: Reference env vars, don't include values
        // Passwords loaded at runtime from:
        // - root_password_env_var
        // - disk_encryption.pass_key_env_var
        // - vault paths
      };

      fs.writeFileSync(
        path.join(hostVarsDir, `${server.name}.yaml`),
        yaml.dump(hostVars, { indent: 2 })
      );
    });
  }

  // Generate host vars for VMs
  if (normalized.compute?.virtual_machines) {
    normalized.compute.virtual_machines.forEach((vm) => {
      const hostVars = {
        vm_id: vm.vm_id,
        vm_name: vm.name,
        host: vm.host,
        role: vm.role,

        // SECURITY: No passwords, tokens, or keys
      };

      fs.writeFileSync(
        path.join(hostVarsDir, `${vm.name}.yaml`),
        yaml.dump(hostVars, { indent: 2 })
      );
    });
  }
}

/**
 * Saves inventory to file
 */
export function saveInventory(
  inventory: AnsibleInventory,
  outputPath: string
): void {
  const yamlContent = yaml.dump(inventory, {
    indent: 2,
    lineWidth: 120,
    noRefs: true,
  });

  fs.writeFileSync(outputPath, yamlContent, "utf8");
}
