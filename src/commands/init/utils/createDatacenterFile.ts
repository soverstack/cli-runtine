import { InitOptions } from "../utils";
import fs from "fs";
import path from "path";

export const createDatacenterFile = ({ projectName }: InitOptions, env?: string): void => {
  const fileName = env ? `dc-${env}.yaml` : "datacenter.yaml";
  const projectPath = path.resolve(process.cwd(), projectName);

  const filePath = path.join(projectPath, "layers/datacenters", fileName);

  const content = `# ============================================================
#  DATACENTER CONFIGURATION${env ? ` - ${env.toUpperCase()}` : ""}
# ============================================================
#
# Documentation:
# https://docs.soverstack.io/configuration/datacenters
#
# ============================================================
# 🚨 CRITICAL HA REQUIREMENTS — READ BEFORE DEPLOYING
# ============================================================
#
# ❗ MINIMUM 3 NODES REQUIRED FOR HIGH AVAILABILITY
#    - Less than 3 nodes = NO quorum
#    - NO fault tolerance
#
# ❗ FAILOVER NETWORK IS MANDATORY FOR HA
#    - Production clusters MUST use failover subnets
#    - Single network = single point of failure
#
# ❗ CEPH REQUIRES DEDICATED & RELIABLE NETWORKING
#    - Minimum 10 GbE recommended
#    - Low latency, isolated traffic
#
# ❗ READ THE NETWORKING DOCUMENTATION CAREFULLY
#    https://docs.soverstack.io/deep-dive/k8s-networking
#
# ============================================================

name: ${projectName}-dc${env ? `-${env}` : ""}

# ------------------------------------------------------------
# SERVERS
# ------------------------------------------------------------
# ⚠️ REQUIRED:
# - Minimum 3 servers for HA
# - Odd number recommended for quorum-based systems
#
servers: []

# ------------------------------------------------------------
# NETWORK CONFIGURATION
# ------------------------------------------------------------
network:
  type: "vswitch"        # vrack | local | wireguard
  failover_subnet: "203.0.113.0/29"  # REQUIRED for HA setups and public access

# ------------------------------------------------------------
# CEPH CONFIGURATION
# ------------------------------------------------------------
# ⚠️ WARNING:
# - Ceph without proper networking WILL cause performance issues
# - Ceph without redundancy = DATA LOSS RISK
#
ceph:
  enabled: true
  servers: []            # List of server names participating in Ceph at least 3 required

# ------------------------------------------------------------
# ALERTING
# ------------------------------------------------------------
alert:
  admin_email: "admin@example.com"
`;

  fs.writeFileSync(filePath, content);
};
