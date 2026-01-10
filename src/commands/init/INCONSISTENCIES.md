# 🔍 Rapport d'Incohérences - types.ts vs init/

Ce document liste toutes les incohérences identifiées entre les définitions TypeScript dans `src/types.ts` et les fichiers générés dans `src/commands/init/`.

---

## ❌ **Incohérence 1: Placement des fichiers Firewall & Bastion**

**Gravité:** 🔴 CRITIQUE

### Problème

**Fichiers actuels:**

```typescript
// createFirewallFile.ts ligne 8
const filePath = path.join(projectPath, "layers/clusters", fileName);

// createBastionFile.ts ligne 8
const filePath = path.join(projectPath, "layers/clusters", fileName);
```

**Résultat:**

```
layers/
  clusters/
    firewall-prod.yaml  ← Firewall n'est PAS un cluster!
    bastion-prod.yaml   ← Bastion n'est PAS un cluster!
    k8s-prod.yaml
```

### Solution Recommandée

**Créer des dossiers dédiés:**

```
layers/
  firewalls/
    firewall-prod.yaml
  bastions/
    bastion-prod.yaml
  clusters/
    k8s-prod.yaml
```

**Modifier:**

- `createFirewallFile.ts` → `layers/firewalls/`
- `createBastionFile.ts` → `layers/bastions/`
- `logic.ts` → Créer les dossiers `layers/firewalls` et `layers/bastions`

**Impact sur Platform.layers:**

```typescript
layers: {
  bastions: "./layers/bastions/bastion-prod.yaml",    // ✅
  firewall: "./layers/firewalls/firewall-prod.yaml",  // ✅
  datacenter: "./layers/datacenters/dc-prod.yaml",
  compute: "./layers/computes/compute-prod.yaml",
  clusters: "./layers/clusters/k8s-prod.yaml",
  features: "./layers/features/features-prod.yaml",
};
```

---

## ❌ **Incohérence 2: Ceph - Propriété `enabled` vs `enabled`**

**Gravité:** 🟡 MOYENNE

### Problème

**types.ts (Datacenter):**

```typescript
ceph: {
  private_network?: string;
  public_network?: string;
  enabled?: boolean;  // ← "enabled"
  servers: string[];
};
```

**createDatacenterFile.ts:**

```yaml
ceph:
  enabled: true # ← "enabled"
  servers: []
```

### Solution

**Option A:** Changer `types.ts` pour `enabled: boolean` (recommandé)
**Option B:** Changer les fichiers générés pour `enabled: true`

**Choisir A pour cohérence avec les autres propriétés:**

- `traefik_dashboard.enabled`
- `monitoring.enabled`
- `argocd.enabled`

---

## ❌ **Incohérence 3: Datacenter - Section `cluster` manquante**

**Gravité:** 🟠 IMPORTANTE

### Problème

**types.ts:**

```typescript
export interface Datacenter {
  // ...
  cluster: {
    private_network?: string;
    public_network?: string;
  };
}
```

**createDatacenterFile.ts:** Section `cluster` **absente** dans le fichier généré!

### Solution

Ajouter dans `createDatacenterFile.ts`:

```yaml
# Proxmox Cluster
cluster:
  private_network: "10.0.10.0/24"
  public_network: "10.0.11.0/24"
```

---

## ❌ **Incohérence 4: Ceph - Propriétés `private_network` et `public_network` manquantes**

**Gravité:** 🟠 IMPORTANTE

### Problème

**types.ts:**

```typescript
ceph: {
  private_network?: string;
  public_network?: string;
  enabled?: boolean;
  servers: string[];
};
```

**createDatacenterFile.ts:**

```yaml
ceph:
  enabled: true
  servers: []
  # Manque: private_network et public_network!
```

### Solution

Ajouter dans `createDatacenterFile.ts`:

```yaml
ceph:
  enabled: false
  servers: []
  private_network: "10.0.1.0/24"
  public_network: "10.0.2.0/24"
```

---

## ❌ **Incohérence 5: Features - Propriétés extra non typées**

**Gravité:** 🟡 MOYENNE

### Problème

**createFeatureFile.ts génère:**

```yaml
monitoring:
  enabled: true
  prometheus: true # ← Pas dans types.ts!
  grafana: true # ← Pas dans types.ts!
  alertmanager: true # ← Pas dans types.ts!
  sub_domains: "monitoring"
```

**types.ts:**

```typescript
monitoring?: {
  enabled: boolean;
  sub_domains: string;
  accessible_outside_vpn: boolean;  // ← Manque dans le fichier!
};
```

### Solution

**Option A:** Retirer `prometheus`, `grafana`, `alertmanager` des fichiers générés
**Option B:** Ajouter ces propriétés à `types.ts`

**Recommandation:** **Option A** - Ces détails sont des détails d'implémentation, pas de configuration

Aussi, **ajouter `accessible_outside_vpn`** dans les fichiers générés:

```yaml
monitoring:
  enabled: true
  sub_domains: "monitoring"
  accessible_outside_vpn: false
```

---

## ❌ **Incohérence 6: ID ranges contradictoires**

**Gravité:** 🔴 CRITIQUE

### Problème

**createComputeFile.ts:**

```typescript
// RESERVED ID RANGES:
// - 100-199: Networking & Firewalls (VyOS/OPNsense)
// - 200-299: Bastion & Management (Headscale)
// - 300-399: Load Balancers (HAProxy)
```

**createClusterFile.ts génère:**

```yaml
master_nodes:
  - name: "master-01"
    vm_id: 101 # Commentaire: "reserved range 100-199"
worker_nodes:
  - name: "worker-01"
    vm_id: 201 # Commentaire: "reserved range 200-299"
ha_proxy_nodes:
  - name: "k8s-lb-01"
    vm_id: 301 # Commentaire: "reserved range 300-399"
```

**CONTRADICTION!** Les ranges 100-199, 200-299, 300-399 sont utilisés DEUX FOIS!

### Solution

**Définir les ranges clairement:**

```
100-199: Firewalls (VyOS/OPNsense)
200-299: Bastions (Headscale)
300-399: Load Balancers (HAProxy pour K8s API)
400-499: Kubernetes Masters
500-599: Kubernetes Workers
600-699: CI/CD Runners
700+: General Purpose VMs
```

**Modifier `createClusterFile.ts`:**

```yaml
master_nodes:
  - name: "master-01"
    vm_id: 400 # Range: 400-499

worker_nodes:
  - name: "worker-01"
    vm_id: 500 # Range: 500-599

ha_proxy_nodes:
  - name: "k8s-lb-01"
    vm_id: 300 # Range: 300-399 ✅ Cohérent
```

**Ajouter commentaire dans types.ts:**

```typescript
export interface VMBase {
  name: string;
  vm_id: number;
  // RESERVED ID RANGES:
  // - 100-199: Firewalls
  // - 200-299: Bastions
  // - 300-399: Load Balancers
  // - 400-499: K8s Masters
  // - 500-599: K8s Workers
  // - 600-699: CI Runners
  // - 700+: General Purpose
  host: string;
  role: VMRole;
  // ...
}
```

---

## ❌ **Incohérence 7: Mode Simple - Aucune interface TypeScript**

**Gravité:** 🟠 IMPORTANTE

### Problème

`createSimpleLayerFile.ts` génère une structure complète:

```yaml
project: { ... }
datacenter: { ... }
firewall: { ... }
bastion: { ... }
compute: { ... }
cluster: { ... }
features: { ... }
```

**MAIS** il n'y a **AUCUNE interface** dans `types.ts` pour valider cette structure!

### Solution

**Créer une nouvelle interface dans `types.ts`:**

```typescript
// ───────────────────────────────────────────────────────────────────────────
// SIMPLE INFRASTRUCTURE - Mode simplifié all-in-one
// ───────────────────────────────────────────────────────────────────────────
export interface SimpleInfrastructure {
  project: {
    name: string;
    environment: string;
    domain: string;
  };

  datacenter: Datacenter;
  firewall: Firewall;
  bastion: Bastion;
  compute: ComputeConfig;
  cluster: K8sCluster;
  features: Feature;
}
```

Ou bien, créer une union type:

```typescript
export type InfrastructureConfig =
  | { mode: "advanced"; layers: Platform["layers"] }
  | { mode: "simple"; infrastructure: SimpleInfrastructure };
```

---

## ✅ **Ce qui est cohérent**

### 1. **ComputeConfig structure** ✅

```typescript
// types.ts
export interface ComputeConfig {
  instance_type_definitions: ComputeType[];
  virtual_machines: (VMBasedOnType | VMCustom)[];
  linux_containers: VMCustom[];
}

// createComputeFile.ts génère:
instance_type_definitions: [...]
virtual_machines: [...]
linux_containers: []
```

### 2. **K8sCluster structure** ✅

```typescript
// types.ts
master_nodes: { name: string; vm_id: number; }[];

// createClusterFile.ts génère:
master_nodes:
  - name: "master-01"
    vm_id: 101
```

### 3. **Feature.cluster_name** ✅

Les deux utilisent `cluster_name` correctement

---

## 📋 **Résumé des Actions à Entreprendre**

### Priorité 🔴 CRITIQUE

1. ✅ **[FAIT]** Adapter `createSimpleLayerFile.ts` avec structure complète
2. **Corriger placement Firewall/Bastion:**
   - Créer `layers/firewalls/` et `layers/bastions/`
   - Modifier `createFirewallFile.ts` et `createBastionFile.ts`
   - Modifier `logic.ts` pour créer les bons dossiers
3. **Corriger ID ranges:**
   - Définir ranges officiels dans `types.ts`
   - Modifier `createClusterFile.ts` pour utiliser 400+ pour masters, 500+ pour workers
   - Mettre à jour tous les exemples

### Priorité 🟠 IMPORTANTE

4. **Ajouter section `cluster` dans Datacenter:**
   - Modifier `createDatacenterFile.ts`
5. **Ajouter `private_network` et `public_network` pour Ceph:**
   - Modifier `createDatacenterFile.ts`
6. **Créer interface `SimpleInfrastructure` dans `types.ts`**

### Priorité 🟡 MOYENNE

7. **Standardiser `enabled` vs `enabled`:**
   - Choisir une convention (recommandé: `enabled`)
   - Modifier `types.ts` ou les fichiers générés
8. **Corriger Features:**
   - Retirer `prometheus`, `grafana`, `alertmanager` des fichiers
   - Ajouter `accessible_outside_vpn`

---

## 🎯 **Après Corrections**

### Structure attendue:

```
my-project/
├── platform.yaml
├── layers/
│   ├── firewalls/          ← NOUVEAU
│   │   └── firewall-prod.yaml
│   ├── bastions/           ← NOUVEAU
│   │   └── bastion-prod.yaml
│   ├── datacenters/
│   │   └── dc-prod.yaml    ← Avec cluster + ceph networks
│   ├── computes/
│   │   └── compute-prod.yaml
│   ├── clusters/
│   │   └── k8s-prod.yaml  ← IDs 400+ pour masters, 500+ workers
│   └── features/
│       └── features-prod.yaml  ← Avec accessible_outside_vpn
```

---

**Document créé le:** 2026-01-03
**Auteur:** Claude Code (Analyse automatique)
**Statut:** ✅ createSimpleLayerFile.ts adapté | ⏳ Autres corrections en attente
