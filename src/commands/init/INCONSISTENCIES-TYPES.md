# 🔴 Incohérences CRITIQUES - types.ts vs init/

Analyse complète des incohérences entre `types.ts` et les fichiers générés par `init/`.

---

## ❌ **INCOHÉRENCE 1: VM ID Ranges - CONTRADICTION MAJEURE**

**Gravité:** 🔴🔴🔴 CRITIQUE - BLOQUANT

### Le Problème

**types.ts lignes 303-309:**
```typescript
// # RESERVED ID RANGES: // doit etre valider aussi
// # - 100-199: Networking & Firewalls (VyOS/OPNsense)
// # - 200-299: Bastion & Management (Headscale)
// # - 300-399: Load Balancers (HAProxy)
// # - 400-499: CI/CD Runners & Misc
// # - 500-599: k8s Control Plane (Masters)  ← ICI
// # - 600+: k8s Data Plane (Workers)        ← ICI
```

**createClusterFile.ts lignes 24-44:**
```yaml
master_nodes:
  - name: "master-01"
    vm_id: 101  # range 100-199  ← CONFLIT!
  - name: "master-02"
    vm_id: 102
  - name: "master-03"
    vm_id: 103

worker_nodes:
  - name: "worker-01"
    vm_id: 201  # range 200-299  ← CONFLIT!
  - name: "worker-02"
    vm_id: 202

ha_proxy_nodes:
  - name: "k8s-lb-01"
    vm_id: 301  # range 300-399  ← OK
```

**Validation (rules/vm-id-ranges.ts):**
```typescript
export const VM_ID_RANGES: VMIdRange[] = [
  { min: 100, max: 199, role: "firewall", description: "Firewalls" },
  { min: 200, max: 299, role: "bastion", description: "Bastions" },
  { min: 300, max: 399, role: "general_purpose", description: "Load Balancers" },
  { min: 400, max: 499, role: "k8s_master", description: "Kubernetes Masters" },  ← DIFFÉRENT!
  { min: 500, max: 599, role: "k8s_worker", description: "Kubernetes Workers" },  ← DIFFÉRENT!
  { min: 600, max: 699, role: "ci_runner", description: "CI/CD Runners" },        ← DIFFÉRENT!
];
```

### Le Conflit

**3 versions différentes des ranges!**

1. **types.ts**: Masters=500-599, Workers=600+
2. **createClusterFile.ts**: Masters=100-199, Workers=200-299
3. **Validation**: Masters=400-499, Workers=500-599

### Solution

**DÉCISION REQUISE:** Quelle version est la bonne?

**Option A: Suivre types.ts** (recommandé si c'est la spec officielle)
```
100-199: Firewalls
200-299: Bastions
300-399: Load Balancers
400-499: CI/CD Runners
500-599: K8s Masters
600+: K8s Workers
```

**Option B: Suivre la validation** (plus logique progressivement)
```
100-199: Firewalls
200-299: Bastions
300-399: Load Balancers
400-499: K8s Masters
500-599: K8s Workers
600-699: CI Runners
700+: General Purpose
```

**Actions:**
1. Décider quelle version est correcte
2. Mettre à jour `types.ts` avec le bon commentaire
3. Mettre à jour `createClusterFile.ts` avec les bons IDs
4. Mettre à jour `validation/rules/vm-id-ranges.ts`
5. Mettre à jour `createComputeFile.ts` avec les bons exemples

---

## ❌ **INCOHÉRENCE 2: `instance_type_definitions` vs `type_definitions`**

**Gravité:** 🔴 CRITIQUE

### Le Problème

**types.ts ligne 334:**
```typescript
export interface ComputeConfig {
  instance_type_definitions: ComputeType[];  // ← "instance_type_definitions"
  virtual_machines: (VMBasedOnType | VMCustom)[];
  linux_containers: VMCustom[];
}
```

**Mais partout ailleurs:**

**createComputeFile.ts ligne 23:**
```yaml
# Predefined compute flavors for consistency
type_definitions:  ← PAS "instance_type_definitions"!
  - name: "k8s-master-std"
    cpu: 4
    ram: 8192
```

**validators/compute.ts ligne 17:**
```typescript
if (!compute.instance_type_definitions || compute.instance_type_definitions.length === 0) {
  // Validation utilise "instance_type_definitions"
}
```

**Mais createSimpleLayerFile.ts ligne 119:**
```yaml
type_definitions:  ← PAS "instance_"!
  - name: "k8s-master"
```

### Solution

**Choisir UN nom et l'utiliser partout:**

**Option A:** `type_definitions` (plus court, plus lisible)
- Modifier `types.ts` ligne 334
- Garder les fichiers générés tels quels

**Option B:** `instance_type_definitions` (plus explicite)
- Modifier `createComputeFile.ts`
- Modifier `createSimpleLayerFile.ts`
- Modifier documentation

**Recommandation:** **Option A** - `type_definitions` est plus court et clair

---

## ❌ **INCOHÉRENCE 3: `network` manquant dans createClusterFile**

**Gravité:** 🟠 IMPORTANTE

### Le Problème

**types.ts lignes 419-430:**
```typescript
export interface K8sCluster {
  name: string;
  ha_proxy_nodes: { name: string; vm_id: number; }[];
  master_nodes: { name: string; vm_id: number; }[];
  worker_nodes: { name: string; vm_id: number; }[];
  auto_scaling?: { ... };
  network: {  // ← REQUIS!
    pod_cidr: string;
    service_cidr: string;
    cni?: "cilium" | "calico" | "weave" | "flannel";
    cilium_features?: { ... };
  };
}
```

**createClusterFile.ts:**
```yaml
auto_scaling:
  enabled: true
  ...

# MANQUE la section network!
```

### Solution

Ajouter dans `createClusterFile.ts`:
```yaml
# --- Networking ---
network:
  pod_cidr: "10.244.0.0/16"
  service_cidr: "10.96.0.0/12"
  cni: "cilium"  # cilium | calico | weave | flannel
  cilium_features:
    ebpf_enabled: true
    cluster_mesh: true
```

---

## ❌ **INCOHÉRENCE 4: `auto_scaling.ressources.instance_type` vs `type`**

**Gravité:** 🟡 MOYENNE

### Le Problème

**types.ts lignes 404-410:**
```typescript
ressources: {
  type?: string;  // ← "type"
  cpu?: number;
  ram?: number;
  disk_size?: number;
};
```

**createClusterFile.ts ligne 66 & 74:**
```yaml
ressources:
  instance_type: "standard"  # ← "instance_type" pas "type"!

ressources:
  instance_type: "t3.medium"  # ← "instance_type"
```

### Solution

**Décider:** `type` ou `instance_type`?

**Recommandation:** `instance_type` est plus explicite, modifier `types.ts`

---

## ❌ **INCOHÉRENCE 5: `disk_encryption.enabled` dans types.ts, mais validation cherche `enable`**

**Gravité:** 🟡 MOYENNE

### Le Problème

**types.ts ligne 35-40:**
```typescript
disk_encryption: {
  enabled: boolean;  // ← "enabled"
  pass_key_env_var?: string;
  pass_key_vault_path?: string;
  pass_key?: string;
};
```

**Mais createSimpleLayerFile.ts et createDatacenterFile.ts utilisent `enabled` ✅**

**validators/datacenter.ts ligne 105:**
```typescript
if (server.disk_encryption?.enabled) {  // ← Bon, utilise "enabled"
```

### Solution

**Pas d'incohérence ici finalement!** Tout le monde utilise `enabled`.

---

## ❌ **INCOHÉRENCE 6: Placement des fichiers Firewall/Bastion**

**Gravité:** 🔴 CRITIQUE (déjà identifiée)

### Le Problème

**types.ts lignes 116-124:**
```typescript
layers: {
  bastions?: string;     // ← Suggère un fichier dédié
  firewall?: string;     // ← Suggère un fichier dédié
  datacenter: string;
  compute?: string;
  clusters?: string;
  features?: string;
  ssh?: string;
};
```

**createFirewallFile.ts ligne 8:**
```typescript
const filePath = path.join(projectPath, "layers/clusters", fileName);
// ← Créé dans "clusters/" pas "firewalls/"!
```

**createBastionFile.ts ligne 8:**
```typescript
const filePath = path.join(projectPath, "layers/clusters", fileName);
// ← Créé dans "clusters/" pas "bastions/"!
```

### Solution

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
- `logic.ts` → Créer les dossiers `firewalls` et `bastions`

---

## ❌ **INCOHÉRENCE 7: `cluster_name` vs `name` dans K8sCluster**

**Gravité:** 🟡 MOYENNE

### Le Problème

**types.ts ligne 372-373:**
```typescript
export interface K8sCluster {
  name: string;  // ← "name"
  ...
}
```

**createClusterFile.ts ligne 20:**
```yaml
cluster_name: "${projectName}-k8s${env ? `-${env}` : ""}"  # ← "cluster_name"!
```

### Solution

**Décider:** `name` ou `cluster_name`?

**Analyse:**
- Feature utilise `cluster_name` pour référencer le cluster
- Cohérent d'avoir `cluster_name` dans K8sCluster aussi

**Recommandation:** Modifier `types.ts` de `name` → `cluster_name`

---

## ❌ **INCOHÉRENCE 8: `Bastion.vm_configuration.os_template` est optionnel**

**Gravité:** 🟠 IMPORTANTE

### Le Problème

**types.ts ligne 92:**
```typescript
export interface Bastion {
  ...
  vm_configuration: {
    vm_ids: number[];
    os_template?: string;  // ← OPTIONNEL!
  };
}
```

**Mais c'est REQUIS pour le provisioning!**

**Firewall ligne 79:**
```typescript
os_template: string;  // ← REQUIS (pas optionnel)
```

### Solution

Rendre `os_template` **requis** pour Bastion:
```typescript
os_template: string;  // Pas optionnel
```

---

## ❌ **INCOHÉRENCE 9: SimpleInfrastructure existe mais pas utilisé**

**Gravité:** 🟢 MINEURE

### Le Problème

**types.ts ligne 484-501:**
```typescript
interface SimpleInfrastructure {
  project: { ... };
  datacenter: Datacenter;
  compute: ComputeConfig;
  cluster?: K8sCluster;
  firewall?: Firewall;
  bastion?: Bastion;
  features?: Feature;
  ssh: string;
  state: { ... };
}
```

**Mais `createSimpleLayerFile.ts` génère une structure différente!**

```yaml
project: { ... }
datacenter: { ... }
firewall: { ... }
bastion: { ... }
compute: { ... }
cluster: { ... }
features: { ... }
# Pas de ssh: string
# Pas de state: { ... }
```

### Solution

**Option A:** Aligner `createSimpleLayerFile.ts` avec `SimpleInfrastructure`
**Option B:** Modifier `SimpleInfrastructure` pour refléter ce qui est généré

---

## ❌ **INCOHÉRENCE 10: `auto_scaling.cpu_utilization_percentage` vs `target_cpu_utilization`**

**Gravité:** 🟡 MOYENNE

### Le Problème

**types.ts ligne 396:**
```typescript
cpu_utilization_percentage: number;  // ← "cpu_utilization_percentage"
```

**createClusterFile.ts ligne 57:**
```yaml
target_cpu_utilization: 70  # ← "target_cpu_utilization"!
```

### Solution

**Décider:** quel nom?

**Recommandation:** `cpu_utilization_threshold` (plus précis)
- Modifier `types.ts`
- Modifier `createClusterFile.ts`

---

## 📋 Résumé des Actions Requises

### 🔴 PRIORITÉ CRITIQUE

1. **VM ID Ranges** - DÉCISION REQUISE
   - Quelle version est correcte?
   - Aligner types.ts, createClusterFile.ts, et validation

2. **`instance_type_definitions` vs `type_definitions`**
   - Choisir UN nom
   - Modifier types.ts OU les fichiers générés

3. **Placement Firewall/Bastion**
   - Créer dossiers dédiés
   - Modifier createFirewallFile.ts et createBastionFile.ts

### 🟠 PRIORITÉ IMPORTANTE

4. **`network` manquant dans cluster**
   - Ajouter section network dans createClusterFile.ts

5. **`cluster_name` vs `name`**
   - Modifier types.ts pour utiliser `cluster_name`

6. **`os_template` optionnel dans Bastion**
   - Rendre requis

### 🟡 PRIORITÉ MOYENNE

7. **`ressources.type` vs `instance_type`**
   - Décider et aligner

8. **`cpu_utilization_percentage` vs `target_cpu_utilization`**
   - Choisir un nom cohérent

9. **SimpleInfrastructure pas aligné**
   - Aligner avec ce qui est généré

---

## 🎯 Recommandations pour Correction

### Version Proposée des VM ID Ranges

```typescript
// types.ts - VERSION CORRIGÉE
// # RESERVED ID RANGES:
// # - 100-199: Firewalls (VyOS/OPNsense/pfSense)
// # - 200-299: Bastions (Headscale/Wireguard/Netbird)
// # - 300-399: Load Balancers (HAProxy)
// # - 400-499: K8s Control Plane (Masters)
// # - 500-599: K8s Data Plane (Workers)
// # - 600-699: CI/CD Runners
// # - 700+: General Purpose VMs
```

### Fichiers à Modifier

1. **types.ts:**
   - Corriger VM ID ranges (lignes 303-309)
   - `type_definitions` au lieu de `instance_type_definitions` (ligne 334)
   - `cluster_name` au lieu de `name` dans K8sCluster (ligne 373)
   - `os_template: string` (pas optionnel) dans Bastion (ligne 92)
   - `instance_type` au lieu de `type` dans auto_scaling.ressources (ligne 405)

2. **createClusterFile.ts:**
   - Corriger VM IDs: Masters=400-499, Workers=500-599
   - Ajouter section `network`
   - Utiliser `cluster_name` au lieu de `name`

3. **createFirewallFile.ts & createBastionFile.ts:**
   - Changer path vers `layers/firewalls/` et `layers/bastions/`

4. **logic.ts (init):**
   - Créer dossiers `layers/firewalls` et `layers/bastions`

5. **validators/vm-id-ranges.ts:**
   - Aligner avec la version finale des ranges

---

**Document créé le:** 2026-01-04
**Statut:** 🔴 CRITIQUE - Nécessite décisions urgentes
