# Implementation Checklist - Infrastructure Tier Validation (UPDATED)

Quick reference for implementing conditional validation based on infrastructureTier.

---

## File 1: ha-requirements.ts

**Path:** runtine-nodejs/src/commands/validate/rules/ha-requirements.ts
**Backup:** ha-requirements.ts.backup (already created)

### Import to add
```typescript
import { InfrastructureTierType } from "../../../types";
```

### Function signatures to update

1. validateMinimumNodes - Add parameter: `infrastructureTier: InfrastructureTierType = "production"`
2. validateHostDistribution - Add parameter: `infrastructureTier: InfrastructureTierType = "production"`
3. validateOddNodeCount - Add parameter: `infrastructureTier: InfrastructureTierType = "production"`
4. validateFailoverNetwork - Add parameter: `infrastructureTier: InfrastructureTierType = "production"`
5. validateCephRequirements - Add parameter: `infrastructureTier: InfrastructureTierType = "production"`
6. validateResourceConstraints - Add parameter: `infrastructureTier: InfrastructureTierType = "production"`

### Logic pattern for each function

```typescript
if (condition_not_met) {
  if (infrastructureTier === "local") {
    addWarning(result, layer, field, "Message (OK for local/dev)", "suggestion");
    return true; // Not a blocker
  }

  addError(result, layer, field, "Message (required for production)", "critical", "suggestion");
  return false;
}
```

---

## File 2: firewall.ts

**Path:** runtine-nodejs/src/commands/validate/validators/firewall.ts

### Line 77-84 - validateMinimumNodes
```typescript
// BEFORE
validateMinimumNodes(
  firewall.vm_configuration.vm_ids,
  2,
  "Firewall",
  result,
  layer,
  "vm_configuration.vm_ids"
);

// AFTER
validateMinimumNodes(
  firewall.vm_configuration.vm_ids,
  2,
  "Firewall",
  result,
  layer,
  "vm_configuration.vm_ids",
  infrastructureTier  // ← ADD THIS
);
```

---

## File 3: bastion.ts

**Path:** runtine-nodejs/src/commands/validate/validators/bastion.ts

### Line 77-84 - validateMinimumNodes
```typescript
// BEFORE
validateMinimumNodes(
  bastion.vm_configuration.vm_ids,
  2,
  "Bastion",
  result,
  layer,
  "vm_configuration.vm_ids"
);

// AFTER
validateMinimumNodes(
  bastion.vm_configuration.vm_ids,
  2,
  "Bastion",
  result,
  layer,
  "vm_configuration.vm_ids",
  infrastructureTier  // ← ADD THIS
);
```

---

## File 4: datacenter.ts

**Path:** runtine-nodejs/src/commands/validate/validators/datacenter.ts

### Line 45 - validateMinimumNodes
```typescript
// BEFORE
validateMinimumNodes(datacenter.servers, 3, "Proxmox cluster", result, layer, "servers");

// AFTER
validateMinimumNodes(datacenter.servers, 3, "Proxmox cluster", result, layer, "servers", infrastructureTier);
```

### Line 48 - validateOddNodeCount
```typescript
// BEFORE
validateOddNodeCount(datacenter.servers.length, "Proxmox cluster", result, layer, "servers");

// AFTER
validateOddNodeCount(datacenter.servers.length, "Proxmox cluster", result, layer, "servers", infrastructureTier);
```

### Line 116 - validateFailoverNetwork
```typescript
// BEFORE
validateFailoverNetwork(datacenter.network.failover_subnet, hasHA, result, layer);

// AFTER
validateFailoverNetwork(datacenter.network.failover_subnet, hasHA, result, layer, infrastructureTier);
```

### Line 134 - validateCephRequirements
```typescript
// BEFORE
validateCephRequirements(cephEnabled, datacenter.ceph.servers || [], result, layer);

// AFTER
validateCephRequirements(cephEnabled, datacenter.ceph.servers || [], result, layer, infrastructureTier);
```

---

## File 5: compute.ts

**Path:** runtine-nodejs/src/commands/validate/validators/compute.ts

### Find all calls to validateResourceConstraints

Search for: `validateResourceConstraints(`

Update each call to add infrastructureTier as last parameter:

```typescript
// BEFORE
validateResourceConstraints(vm.name, vm.role, cpu, ram, result, layer);

// AFTER
validateResourceConstraints(vm.name, vm.role, cpu, ram, result, layer, infrastructureTier);
```

Likely locations: around lines 180-200 in VM validation loops.

---

## File 6: cluster.ts

**Path:** runtine-nodejs/src/commands/validate/validators/cluster.ts

### Line 45-52 - validateMinimumNodes for masters
```typescript
// BEFORE
validateMinimumNodes(
  cluster.master_nodes,
  3,
  "Kubernetes masters (Etcd quorum)",
  result,
  layer,
  "master_nodes"
);

// AFTER
validateMinimumNodes(
  cluster.master_nodes,
  3,
  "Kubernetes masters (Etcd quorum)",
  result,
  layer,
  "master_nodes",
  infrastructureTier  // ← ADD THIS
);
```

### Line 55-61 - validateOddNodeCount for masters
```typescript
// BEFORE
validateOddNodeCount(
  cluster.master_nodes.length,
  "Kubernetes masters",
  result,
  layer,
  "master_nodes"
);

// AFTER
validateOddNodeCount(
  cluster.master_nodes.length,
  "Kubernetes masters",
  result,
  layer,
  "master_nodes",
  infrastructureTier  // ← ADD THIS
);
```

### Line 64-70 - validateHostDistribution for masters
```typescript
// BEFORE
validateHostDistribution(
  cluster.master_nodes,
  "Kubernetes master",
  result,
  layer,
  "master_nodes"
);

// AFTER
validateHostDistribution(
  cluster.master_nodes,
  "Kubernetes master",
  result,
  layer,
  "master_nodes",
  infrastructureTier  // ← ADD THIS
);
```

### Line 108-114 - validateHostDistribution for workers
```typescript
// BEFORE
validateHostDistribution(
  cluster.worker_nodes,
  "Kubernetes worker",
  result,
  layer,
  "worker_nodes"
);

// AFTER
validateHostDistribution(
  cluster.worker_nodes,
  "Kubernetes worker",
  result,
  layer,
  "worker_nodes",
  infrastructureTier  // ← ADD THIS
);
```

### Line 155 - validateHostDistribution for HAProxy
```typescript
// BEFORE
validateHostDistribution(cluster.ha_proxy_nodes, "HAProxy", result, layer, "ha_proxy_nodes");

// AFTER
validateHostDistribution(cluster.ha_proxy_nodes, "HAProxy", result, layer, "ha_proxy_nodes", infrastructureTier);
```

---

## File 7: logic.ts (Environment Validation)

**Path:** runtine-nodejs/src/commands/validate/logic.ts

### Add import
```typescript
import fs from "fs";
```

### Add function after line 235 (end of file)

```typescript
/**
 * Validates that configured environments have corresponding .env files
 */
function validateEnvironments(
  platform: Platform,
  platformDir: string,
  result: ValidationResult
): void {
  if (!platform.environment) return;

  const envFile = path.join(platformDir, `.env.${platform.environment}`);
  const fallbackEnvFile = path.join(platformDir, `.env`);

  if (!fs.existsSync(envFile) && !fs.existsSync(fallbackEnvFile)) {
    addWarning(
      result,
      "platform",
      "environment",
      `Environment "${platform.environment}" configured but no .env.${platform.environment} or .env file found`,
      `Create .env.${platform.environment} file with required environment variables`
    );
  }
}
```

### Call function after line 69 (after loading platform)

```typescript
// After platform.layers validation
validateEnvironments(platform, platformDir, result);
```

---

## Summary of Changes

### Total Files to Modify: 7

1. **ha-requirements.ts** - Add tier parameter to 6 functions
2. **firewall.ts** - Add tier to 1 function call
3. **bastion.ts** - Add tier to 1 function call
4. **datacenter.ts** - Add tier to 4 function calls
5. **compute.ts** - Add tier to all validateResourceConstraints calls
6. **cluster.ts** - Add tier to 5 function calls
7. **logic.ts** - Add environment validation function

### Total Function Calls to Update: ~15+

- firewall.ts: 1 call
- bastion.ts: 1 call
- datacenter.ts: 4 calls
- compute.ts: variable (all resource constraint validations)
- cluster.ts: 5 calls

---

## Testing Commands

### After implementation, test:

```bash
# Test local tier with single server (should warn, not error)
soverstack validate platform-local.yaml

# Test production tier with single server (should error)
soverstack validate platform-prod.yaml

# Test environment validation
soverstack validate platform-dev.yaml  # Should warn if .env.dev missing
```

---

## Verification Checklist

- [ ] ha-requirements.ts: All 6 functions have infrastructureTier parameter
- [ ] firewall.ts: validateMinimumNodes call updated
- [ ] bastion.ts: validateMinimumNodes call updated
- [ ] datacenter.ts: 4 function calls updated
- [ ] compute.ts: All validateResourceConstraints calls updated
- [ ] cluster.ts: 5 HA validation calls updated
- [ ] logic.ts: validateEnvironments function added and called
- [ ] All files compile without errors
- [ ] Local tier allows 1 server with warnings
- [ ] Production tier requires 3+ servers with errors
- [ ] Resource requirements relaxed for local tier

---

**Ready for implementation. Start with File 1 (ha-requirements.ts) and work sequentially.**
