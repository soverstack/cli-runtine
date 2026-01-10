# Validation Command - Architecture

Documentation de la commande `validate` et de son architecture modulaire.

---

## 📁 Structure

```
validate/
├── index.ts                     # CLI command entry point
├── logic.ts                     # Main validation orchestrator
├── validators/                  # Layer-specific validators
│   ├── index.ts
│   ├── datacenter.ts           # Validates datacenter configuration
│   ├── compute.ts              # Validates compute resources
│   ├── cluster.ts              # Validates K8s cluster
│   ├── firewall.ts             # Validates firewall
│   ├── bastion.ts              # Validates bastion/VPN
│   └── feature.ts              # Validates features
├── rules/                       # Reusable validation rules
│   ├── index.ts
│   ├── vm-id-ranges.ts         # VM ID range validation
│   ├── ha-requirements.ts      # HA and resource constraints
│   └── security.ts             # Security validation rules
└── utils/                       # Utilities
    ├── index.ts
    ├── types.ts                # Validation types
    ├── yaml-loader.ts          # YAML file loading
    └── error-formatter.ts      # Error formatting for display
```

---

## 🎯 Design Principles

### 1. **Modularity**
- Each layer has its own validator module
- Reusable rules are extracted into `rules/`
- No monolithic validation file

### 2. **Separation of Concerns**
- **Validators**: Layer-specific validation logic
- **Rules**: Cross-cutting validation rules
- **Utils**: Helper functions and types

### 3. **Cross-Layer Validation**
- `ValidationContext` tracks state across layers
- VM IDs checked for uniqueness across all layers
- References validated (e.g., cluster → compute VMs)

### 4. **Ordered Validation**
Layers are validated in dependency order:
1. **Datacenter** (foundational)
2. **Firewall** (uses datacenter network)
3. **Bastion** (uses datacenter network)
4. **Compute** (uses datacenter servers)
5. **Cluster** (references compute VMs)
6. **Features** (references cluster)

---

## 🔍 Validation Flow

### Step 1: Load `platform.yaml`
```typescript
const platform = loadYamlFile<Platform>(platformYamlPath, result, "platform");
```

### Step 2: Initialize Context
```typescript
const context: ValidationContext = {
  vm_ids_used: new Map(),      // Track VM ID uniqueness
  server_names: new Set(),      // Track server names
  host_names: new Set(),        // Track Proxmox hosts
  cluster_names: new Set(),     // Track cluster names
};
```

### Step 3: Validate Each Layer
```typescript
// Example: Datacenter validation
const datacenter = loadYamlFile<Datacenter>(platform.layers.datacenter, result, "datacenter");
validateDatacenter(datacenter, context, result);
```

### Step 4: Return Results
```typescript
return {
  valid: boolean,
  errors: ValidationError[],
  warnings: ValidationWarning[]
};
```

---

## 📋 Validation Rules

### VM ID Ranges

**Defined in:** `rules/vm-id-ranges.ts`

```
100-199: Firewalls (VyOS/OPNsense/pfSense)
200-299: Bastions (Headscale/Wireguard/Netbird)
300-399: Load Balancers (HAProxy for K8s API)
400-499: Kubernetes Masters
500-599: Kubernetes Workers
600-699: CI/CD Runners
700+: General Purpose VMs
```

**Validates:**
- VM IDs are in correct range for their role
- VM IDs are unique across all layers
- No conflicts between layers

---

### HA Requirements

**Defined in:** `rules/ha-requirements.ts`

**Validates:**
- Minimum 3 nodes for quorum-based systems
- Odd number recommended for quorum voting
- Nodes distributed across different hosts
- Failover network configured for HA
- Resource constraints (CPU, RAM) for VM roles

**Examples:**
```typescript
// Minimum 3 servers for Proxmox cluster
validateMinimumNodes(servers, 3, "Proxmox cluster", result, layer, "servers");

// Distribute masters across different hosts
validateHostDistribution(masterNodes, "K8s master", result, layer, "master_nodes");

// K8s master needs >= 4GB RAM
validateResourceConstraints(vmName, "k8s_master", cpu, ram, result, layer);
```

---

### Security Rules

**Defined in:** `rules/security.ts`

**Validates:**
- No plain text passwords
- `accessible_outside_vpn` explicitly set
- OIDC enforced for Bastion
- Valid CIDR and IP formats
- SSH key configuration

**Examples:**
```typescript
// No plain text passwords
validateNoPlainTextPassword(
  server.root_password,
  server.root_password_env_var,
  server.root_password_vault_path,
  "root_password",
  result,
  layer
);

// Explicit accessible_outside_vpn
validateAccessibleOutsideVpn(
  feature.monitoring.accessible_outside_vpn,
  "monitoring",
  result,
  layer
);
```

---

## 🚀 Usage Examples

### Basic Validation
```bash
soverstack validate platform.yaml
```

**Output:**
```
✅ Validation successful!

✨ Configuration is valid and ready to use!
```

---

### Validate Specific Layer
```bash
soverstack validate platform.yaml --layer datacenter
```

**Output:**
```
❌ Validation failed!

🚨 3 Error(s):

🔴 [datacenter] servers[0].root_password
   Plain text password detected - CRITICAL SECURITY RISK!
   💡 Remove the plain text password and use:
   - root_password_env_var: "ENV_VAR_NAME" (recommended)
   - root_password_vault_path: "secret/data/path" (most secure)

❗ [datacenter] network.failover_subnet
   Failover subnet is REQUIRED for High Availability setups
   💡 Configure a failover subnet (e.g., '203.0.113.0/29') for public IP failover

❗ [datacenter] ceph.servers
   Ceph requires at least 3 servers for data redundancy, found 1
   💡 Add more servers to Ceph cluster or disable Ceph (set enabled: false)
```

---

### JSON Output
```bash
soverstack validate platform.yaml --json
```

**Output:**
```json
{
  "valid": false,
  "error_count": 3,
  "warning_count": 1,
  "errors": [
    {
      "layer": "datacenter",
      "field": "servers[0].root_password",
      "message": "Plain text password detected - CRITICAL SECURITY RISK!",
      "severity": "critical",
      "suggestion": "Remove the plain text password and use environment variables or Vault"
    }
  ],
  "warnings": []
}
```

---

## 🛠️ Extending Validation

### Adding a New Validator

**1. Create validator file:**
```typescript
// validators/my-layer.ts
import { MyLayer } from "../../../types";
import { ValidationResult, ValidationContext, addError } from "../utils/types";

export function validateMyLayer(
  data: MyLayer,
  context: ValidationContext,
  result: ValidationResult
): void {
  const layer = "my-layer";

  if (!data.name) {
    addError(result, layer, "name", "Name is required", "error");
  }

  // Add more validations...
}
```

**2. Export in `validators/index.ts`:**
```typescript
export * from "./my-layer";
```

**3. Add to `logic.ts`:**
```typescript
if (platform.layers.my_layer) {
  const myLayer = loadYamlFile<MyLayer>(platform.layers.my_layer, result, "my-layer");
  if (myLayer) {
    validateMyLayer(myLayer, context, result);
  }
}
```

---

### Adding a New Rule

**1. Create rule file:**
```typescript
// rules/my-rule.ts
import { ValidationResult, addError } from "../utils/types";

export function validateMyRule(
  value: any,
  fieldName: string,
  result: ValidationResult,
  layer: string
): boolean {
  if (!isValid(value)) {
    addError(result, layer, fieldName, "Validation failed", "error", "Fix suggestion");
    return false;
  }
  return true;
}
```

**2. Export in `rules/index.ts`:**
```typescript
export * from "./my-rule";
```

**3. Use in validators:**
```typescript
import { validateMyRule } from "../rules";

validateMyRule(data.field, "field", result, layer);
```

---

## 📊 Validation Levels

### Error Severities

- **`critical`**: 🔴 Blocking issue, cannot proceed
  - Example: Missing required file, security vulnerability

- **`error`**: ❗ Validation failure, must be fixed
  - Example: Invalid configuration, missing required field

### Warnings

- **`warning`**: ⚠️ Non-blocking but should be addressed
  - Example: Suboptimal configuration, missing recommended field

---

## 🔒 Security Validations

### Critical Security Checks

1. **No Plain Text Passwords**
   - All passwords must use env vars or Vault
   - Plain text passwords trigger `critical` error

2. **Explicit `accessible_outside_vpn`**
   - No unsafe defaults
   - Must be explicitly `true` or `false`

3. **OIDC Enforced for Bastion**
   - `oidc_enforced: true` is mandatory
   - Cannot be disabled

4. **Valid Network Configurations**
   - CIDR format validation
   - IP address format validation
   - No overlapping networks

---

## 🎓 Best Practices

### 1. **Fail Fast**
- Validate critical errors first
- Return early if foundational layers fail

### 2. **Provide Context**
- Include field paths (e.g., `servers[0].root_password`)
- Provide actionable suggestions

### 3. **Cross-Layer Awareness**
- Use `ValidationContext` to track state
- Validate references between layers

### 4. **Clear Error Messages**
```typescript
// Bad
addError(result, layer, "field", "Invalid");

// Good
addError(
  result,
  layer,
  "servers[0].root_password",
  "Plain text password detected - CRITICAL SECURITY RISK!",
  "critical",
  "Use root_password_env_var or root_password_vault_path instead"
);
```

---

## 📚 Related Documentation

- [types.ts](../../types.ts) - All type definitions
- [init/](../init/) - Project initialization logic
- [INCONSISTENCIES.md](../init/INCONSISTENCIES.md) - Known issues between types and implementation

---

**La validation est modulaire, extensible, et sécurisée!** 🎯
