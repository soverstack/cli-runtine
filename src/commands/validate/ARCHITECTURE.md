# Validation Architecture

## Overview

La validation Soverstack utilise une architecture en 4 étapes qui unifie les modes "simple" et "advanced" avant validation.

```
┌─────────────────────────────────────────────────────────────┐
│                    USER INPUT                                │
├──────────────────────┬──────────────────────────────────────┤
│   Simple Mode        │         Advanced Mode                │
│                      │                                       │
│   infrastructure.    │   datacenter.yaml                    │
│   yaml               │   firewall.yaml                      │
│   (all-in-one)       │   bastion.yaml                       │
│                      │   compute.yaml                       │
│                      │   cluster.yaml                       │
│                      │   features.yaml                      │
└──────────────────────┴──────────────────────────────────────┘
                          │
                          ▼
         ┌────────────────────────────────┐
         │  STEP 1: Load platform.yaml    │
         └────────────────────────────────┘
                          │
                          ▼
         ┌────────────────────────────────┐
         │  STEP 2: NORMALIZE             │
         │  → NormalizedInfrastructure    │
         │  (unified format)              │
         └────────────────────────────────┘
                          │
                          ▼
         ┌────────────────────────────────┐
         │  STEP 3: APPLY DEFAULTS        │
         │  - Security defaults           │
         │  - HA defaults                 │
         │  - Network defaults            │
         └────────────────────────────────┘
                          │
                          ▼
         ┌────────────────────────────────┐
         │  STEP 4: VALIDATE              │
         │  - Datacenter                  │
         │  - Firewall                    │
         │  - Bastion                     │
         │  - Compute                     │
         │  - Cluster                     │
         │  - Features                    │
         └────────────────────────────────┘
                          │
                          ▼
         ┌────────────────────────────────┐
         │      VALIDATION RESULT         │
         │   (errors, warnings, info)     │
         └────────────────────────────────┘
```

---

## STEP 1: Load platform.yaml

Le fichier `platform.yaml` sert de point d'entrée:

```yaml
name: "my-platform"
version: "1.0.0"
environment: "prod"
domain: "example.com"

layers:
  datacenter: "layers/infrastructure.yaml"  # Simple mode
  # OU
  datacenter: "layers/datacenters/dc-prod.yaml"  # Advanced mode
  firewall: "layers/firewalls/firewall-prod.yaml"
  bastions: "layers/bastions/bastion-prod.yaml"
  compute: "layers/computes/compute-prod.yaml"
  clusters: "layers/clusters/k8s-prod.yaml"
  features: "layers/features/features-prod.yaml"
```

**Détection du mode:**
- **Simple:** `!layers.compute && !layers.clusters` → tout est dans `layers.datacenter`
- **Advanced:** Fichiers séparés

---

## STEP 2: Normalisation

**Objectif:** Unifier les deux modes en une seule structure `NormalizedInfrastructure`

### Mode Simple
Le fichier `infrastructure.yaml` contient déjà tout:
```yaml
datacenter: { ... }
firewall: { ... }
bastion: { ... }
compute: { ... }
cluster: { ... }
features: { ... }
```

→ Extraction directe vers `NormalizedInfrastructure`

### Mode Advanced
Chargement et fusion de chaque fichier:
```typescript
{
  datacenter: loadYaml("layers/datacenters/dc-prod.yaml"),
  firewall: loadYaml("layers/firewalls/firewall-prod.yaml"),
  bastion: loadYaml("layers/bastions/bastion-prod.yaml"),
  compute: loadYaml("layers/computes/compute-prod.yaml"),
  cluster: loadYaml("layers/clusters/k8s-prod.yaml"),
  features: loadYaml("layers/features/features-prod.yaml"),
}
```

### NormalizedInfrastructure Type
```typescript
interface NormalizedInfrastructure {
  project: {
    name: string;
    environment?: string;
    domain: string;
  };
  datacenter: Datacenter;
  firewall?: Firewall;
  bastion?: Bastion;
  compute: ComputeConfig;
  cluster?: K8sCluster;
  features?: Feature;
  ssh?: string;
  state?: {
    backend: "local";
    path: string;
  };
}
```

**Fichier:** `utils/normalizer.ts`

---

## STEP 3: Apply Defaults

**Objectif:** Garantir sécurité et HA même si l'utilisateur ne configure pas tout

### Defaults de Sécurité
```typescript
// Firewall activé par défaut
firewall.enabled = firewall.enabled ?? true;

// Bastion OIDC TOUJOURS enforced (pas configurable)
bastion.oidc_enforced = true;

// Features: VPN-only par défaut
features.*.accessible_outside_vpn = false;
```

### Defaults de HA
```typescript
// Bastion: Postgres pour HA
bastion.database_type = bastion.database_type ?? "postgres";

// Cluster: Minimum 3 nodes
cluster.auto_scaling.min_nodes = cluster.auto_scaling.min_nodes ?? 3;
```

### Defaults de Network
```typescript
// Kubernetes networking
cluster.network.pod_cidr = cluster.network.pod_cidr ?? "10.244.0.0/16";
cluster.network.service_cidr = cluster.network.service_cidr ?? "10.96.0.0/12";
cluster.network.cni = cluster.network.cni ?? "cilium";

// Cilium features (eBPF + Cluster Mesh pour hybrid cloud)
cluster.network.cilium_features.ebpf_enabled = true;
cluster.network.cilium_features.cluster_mesh = true;

// Bastion VPN subnet (CGNAT range)
bastion.vpn_subnet = bastion.vpn_subnet ?? "100.64.0.0/10";
```

**Fichier:** `utils/defaults.ts`

**Documentation des defaults:** `getDefaultsDocumentation()`

---

## STEP 4: Validation

Une fois normalisée et enrichie avec les defaults, l'infrastructure passe par les validateurs dans l'ordre de dépendance:

```
Datacenter → Firewall → Bastion → Compute → Cluster → Features
```

### Validation Rules

#### VM ID Ranges
```typescript
100-199: Firewalls
200-299: Bastions
300-399: Load Balancers
400-499: CI/CD Runners
500-599: K8s Masters
600+: K8s Workers
```

#### HA Requirements
- Minimum 3 serveurs Proxmox (quorum)
- Odd number recommandé (3, 5, 7)
- Distribution des VMs sur différents hosts
- Minimum 2 VMs pour firewall/bastion

#### Security Rules
- ❌ Pas de mots de passe en clair
- ✅ Utiliser `root_password_env_var` ou `root_password_vault_path`
- ✅ OIDC enforced sur Bastion
- ✅ Features VPN-only par défaut

#### Resource Constraints
```typescript
k8s_master: min 4 CPU, 8192 MB RAM
k8s_worker: min 8 CPU, 16384 MB RAM
```

**Fichiers:**
- `rules/vm-id-ranges.ts`
- `rules/ha-requirements.ts`
- `rules/security.ts`
- `validators/datacenter.ts`
- `validators/firewall.ts`
- `validators/bastion.ts`
- `validators/compute.ts`
- `validators/cluster.ts`
- `validators/feature.ts`

---

## Cross-Layer Validation

Le `ValidationContext` permet de valider les références entre layers:

```typescript
interface ValidationContext {
  vm_ids_used: Map<number, string>;  // Track uniqueness
  server_names: Set<string>;         // Datacenter servers
  host_names: Set<string>;           // Proxmox hosts used by VMs
  cluster_names: Set<string>;        // K8s cluster names
}
```

### Exemples de validations cross-layer:

**Compute → Cluster:**
```typescript
// Vérifier que les VM IDs du cluster existent dans compute
cluster.master_nodes.forEach(node => {
  if (!context.vm_ids_used.has(node.vm_id)) {
    error("VM ID not found in compute config");
  }
});
```

**Cluster → Features:**
```typescript
// Vérifier que le cluster_name existe
if (!context.cluster_names.has(features.cluster_name)) {
  error("Cluster not found");
}
```

---

## File Structure

```
validate/
├── logic.ts                 # Main orchestrator
├── index.ts                 # CLI command
├── ARCHITECTURE.md          # This file
├── README.md                # Usage guide
│
├── utils/
│   ├── normalizer.ts        # Simple/Advanced → Normalized
│   ├── defaults.ts          # Apply defaults
│   ├── yaml-loader.ts       # YAML loading
│   ├── types.ts             # ValidationResult, Context
│   └── error-formatter.ts   # Pretty output
│
├── rules/
│   ├── vm-id-ranges.ts      # VM ID validation
│   ├── ha-requirements.ts   # HA rules
│   └── security.ts          # Security rules
│
└── validators/
    ├── datacenter.ts
    ├── firewall.ts
    ├── bastion.ts
    ├── compute.ts
    ├── cluster.ts
    └── feature.ts
```

---

## Usage

### Validate tout
```bash
soverstack validate platform.yaml
```

### Validate un layer spécifique
```bash
soverstack validate platform.yaml --layer cluster
```

### Output JSON
```bash
soverstack validate platform.yaml --json
```

### Verbose mode
```bash
soverstack validate platform.yaml --verbose
```

---

## Exit Codes

- `0`: ✅ Validation passed
- `1`: ❌ Validation failed (errors or critical warnings)

---

## Benefits of This Architecture

✅ **Unified Validation:** Simple et Advanced passent par la même logique

✅ **Security by Default:** Defaults sécurisés appliqués automatiquement

✅ **HA by Default:** Configuration HA minimale garantie

✅ **Maintainable:** Logique centralisée, pas de duplication

✅ **Testable:** Normalizer, defaults, et validators testables séparément

✅ **Extensible:** Facile d'ajouter de nouveaux layers ou règles
