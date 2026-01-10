# Validation Refactor Progress - Infrastructure Tier Support

**Date:** 2026-01-05
**Status:** IN PROGRESS
**Objective:** Add conditional validation based on infrastructureTier (local/production/enterprise)

---

## Goal

Allow developers to use Soverstack in **local/homelab** environments without strict HA requirements:

- **Local tier:** Single server OK, reduced resource requirements, HA optional (warnings instead of errors)
- **Production tier:** 3+ servers required, strict HA enforcement, full resource requirements
- **Enterprise tier:** Same as production + full network isolation

---

## Completed

### 1. Type Definitions
**File:** runtine/src/types.ts

Added infrastructureTier to Platform interface and network_mapping to Datacenter.

### 2. Init Command
**Files:**
- runtine-nodejs/src/commands/init/index.ts - Interactive tier selection
- runtine-nodejs/src/commands/init/utils/index.ts - Added infrastructureTier to InitOptions
- runtine-nodejs/src/commands/init/utils/generatePlatformYaml.ts - Generates infrastructure_tier field

Interactive prompts:
- Local / Homelab → Single server, no HA required
- Production → 3+ servers, HA enforced
- Enterprise → Full network isolation, maximum redundancy

For local tier:
- Skips environment prompt (single environment only)
- Shows warning if --env is provided

### 3. Validation Orchestrator
**File:** runtine-nodejs/src/commands/validate/logic.ts

Already passes infrastructureTier to all validators (lines 101-130).

---

## In Progress

### 4. HA Rules Refactor
**File:** runtine-nodejs/src/commands/validate/rules/ha-requirements.ts

**Status:** Backup created (ha-requirements.ts.backup), new version ready to be written

**Changes needed:** Add infrastructureTier parameter to all functions with conditional logic.

#### Functions to modify:

**validateMinimumNodes:**
- Local: Warning if < minCount (acceptable for dev)
- Production/Enterprise: Error if < minCount

**validateHostDistribution:**
- Local: Warning if nodes on same host (OK for dev)
- Production/Enterprise: Error (fault tolerance required)

**validateOddNodeCount:**
- Skip for local tier or < 3 nodes
- Warn for production/enterprise with even node count

**validateFailoverNetwork:**
- Local: Warning if missing (optional)
- Production/Enterprise: Error (required)

**validateCephRequirements:**
- Local: Warning if < 3 servers (OK for dev)
- Production/Enterprise: Error (3+ servers required)

**validateResourceConstraints:**
Local tier minimums:
- K8s Master: 1 CPU / 2GB RAM (warning if below)
- K8s Worker: 1 CPU / 1GB RAM (warning if below)

Production/Enterprise minimums:
- K8s Master: 2 CPU / 4GB RAM (error if below)
- K8s Worker: 2 CPU / 2GB RAM (error if below)

---

## To Do

### 5. Update Datacenter Validator
**File:** runtine-nodejs/src/commands/validate/validators/datacenter.ts

**Changes needed:**

Line 45: Add infrastructureTier parameter to validateMinimumNodes
Line 48: Add infrastructureTier parameter to validateOddNodeCount
Line 116: Add infrastructureTier parameter to validateFailoverNetwork
Line 134: Add infrastructureTier parameter to validateCephRequirements

### 6. Update Compute Validator
**File:** runtine-nodejs/src/commands/validate/validators/compute.ts

Find calls to validateResourceConstraints (around line 180-200) and add infrastructureTier parameter.

### 7. Update Cluster Validator
**File:** runtine-nodejs/src/commands/validate/validators/cluster.ts

Find calls to HA validation functions and add infrastructureTier parameter for master/worker node validation.

### 8. Add Environment Validation
**File:** runtine-nodejs/src/commands/validate/logic.ts

Add new function validateEnvironments that:
1. Checks if environment is configured
2. Verifies .env.{environment} or .env file exists
3. Warns if file not found

Call this function after loading platform (after line 69).

---

## Summary

### Files Modified
1. runtine/src/types.ts - Added infrastructureTier, network_mapping
2. runtine-nodejs/src/commands/init/index.ts - Interactive tier selection
3. runtine-nodejs/src/commands/init/utils/index.ts - InitOptions updated
4. runtine-nodejs/src/commands/init/utils/generatePlatformYaml.ts - Generates infrastructure_tier
5. runtine-nodejs/src/commands/validate/logic.ts - Already passes infrastructureTier

### Files To Modify
1. runtine-nodejs/src/commands/validate/rules/ha-requirements.ts - Add tier parameter to all functions
2. runtine-nodejs/src/commands/validate/validators/datacenter.ts - Update 4 function calls
3. runtine-nodejs/src/commands/validate/validators/compute.ts - Update validateResourceConstraints calls
4. runtine-nodejs/src/commands/validate/validators/cluster.ts - Update HA validation calls
5. runtine-nodejs/src/commands/validate/logic.ts - Add validateEnvironments function

### Backup Files Created
- runtine-nodejs/src/commands/validate/rules/ha-requirements.ts.backup

---

## Testing Plan

After implementation, test with:

### Local Tier
YAML with infrastructure_tier: local and single server should WARN, not ERROR

### Production Tier
YAML with infrastructure_tier: production and single server should ERROR

### Environment Validation
YAML with environment: dev should warn if .env.dev doesn't exist

---

## Notes

- infrastructureTier defaults to "production" if not specified (backward compatibility)
- Local tier is for development/testing only, clearly marked in warnings
- Production/Enterprise tiers enforce strict HA and security
- All HA rules should have tier-aware logic

---

**Ready for parallel agent to continue implementation.**
