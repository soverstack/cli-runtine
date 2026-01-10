# Plan Command - Corrections et Améliorations

## Problèmes Identifiés dans `src/commands/plan/index.ts`

### 1. **Messages incomplets et peu clairs**
- ❌ Ligne 30: `ora("Pla...")` - Message tronqué
- ❌ Ligne 10: Description argument: `"Name of the resource to plan"` → devrait être `"Path to platform.yaml file"`
- ❌ Ligne 56: Message d'erreur: `"Validation crashed!"` → devrait être `"Plan generation failed!"`

### 2. **Manque de feedback utilisateur**
- ❌ Pas de message indiquant où le plan a été sauvegardé
- ❌ Pas de résumé du plan généré (nombre de ressources à créer/modifier/supprimer)
- ❌ Pas de suggestions pour les prochaines étapes

### 3. **Manque d'options**
- ❌ Pas d'option `--show-resources` pour afficher les détails des ressources
- ❌ Pas d'option `--show-execution-order` pour visualiser l'ordre d'exécution
- ❌ Pas de validation de l'existence du fichier platform.yaml

###  4. **Code inutile**
- ❌ Ligne 62: Commentaire orphelin `// validateInfrastructure`
- ❌ Ligne 29: Commentaire vide `//`

---

## Améliorations Proposées

### ✅ 1. Messages clairs et descriptifs

```typescript
// AVANT
const spinner = ora("Pla...").start();

// APRÈS
const spinner = ora("Validating infrastructure configuration...").start();
```

```typescript
// AVANT
.argument("<platform-yaml>", "Name of the resource to plan")

// APRÈS
.argument("<platform-yaml>", "Path to platform.yaml file")
```

```typescript
// AVANT
console.log(chalk.red("\n❌ Validation crashed!\n"));

// APRÈS
console.log(chalk.red("\n❌ Plan generation failed!\n"));
```

### ✅ 2. Vérification de l'existence du fichier

```typescript
// Verify platform.yaml exists
const platformPath = path.resolve(platformYaml);
if (!fs.existsSync(platformPath)) {
  console.log(chalk.red(`❌ File not found: ${platformYaml}\n`));
  process.exit(1);
}
```

### ✅ 3. Ajout de nouvelles options

```typescript
.option("--show-resources", "Show detailed resource list in plan summary")
.option("--show-execution-order", "Show execution order of resources")
```

### ✅ 4. Affichage du résumé du plan

```typescript
// Step 3: Load and display plan
spinner.start("Loading execution plan...");

const plan = loadPlan(planOutputPath);

if (!plan) {
  spinner.fail("Failed to load execution plan");
  console.log(chalk.red(`\n❌ Could not load plan from: ${planOutputPath}\n`));
  process.exit(1);
}

spinner.succeed("Execution plan loaded");

// Display plan summary
displayPlanSummary(plan, {
  showResources: options.showResources || false,
  showExecutionOrder: options.showExecutionOrder || false,
});

console.log(chalk.gray(`\n📄 Plan saved to: ${planOutputPath}\n`));
```

### ✅ 5. Fonction `displayPlanSummary`

Affiche:
- **Environment info**: infrastructure tier, environment, timestamp
- **Changes summary**: nombre de ressources à créer/modifier/supprimer
- **Changes by layer**: regroupement par layer (datacenter, compute, cluster, etc.)
- **Detailed resource list** (avec `--show-resources`): Liste complète des ressources
- **Execution order** (avec `--show-execution-order`): Ordre d'exécution en stages

```typescript
function displayPlanSummary(
  plan: InfrastructurePlan,
  options: { showResources: boolean; showExecutionOrder: boolean }
): void {
  console.log(chalk.blue("\n📊 Execution Plan Summary\n"));

  // Environment info
  console.log(chalk.cyan("Environment:"));
  console.log(chalk.gray(`  • Infrastructure tier: ${plan.infrastructure_tier}`));
  if (plan.environment) {
    console.log(chalk.gray(`  • Environment: ${plan.environment}`));
  }
  console.log(chalk.gray(`  • Generated at: ${new Date(plan.generated_at).toLocaleString()}\n`));

  // Changes summary
  console.log(chalk.cyan("Changes:\n"));

  const { to_create, to_update, to_delete, no_change } = plan.summary;
  const totalChanges = to_create + to_update + to_delete;

  if (totalChanges === 0) {
    console.log(chalk.gray("  No changes detected. Infrastructure is up to date.\n"));
    return;
  }

  if (to_create > 0) {
    console.log(chalk.green(`  ➕ ${to_create} resource(s) to create`));
  }
  if (to_update > 0) {
    console.log(chalk.yellow(`  🔄 ${to_update} resource(s) to update`));
  }
  if (to_delete > 0) {
    console.log(chalk.red(`  🗑️  ${to_delete} resource(s) to delete`));
  }
  if (no_change > 0) {
    console.log(chalk.gray(`  ➖ ${no_change} resource(s) unchanged`));
  }

  console.log(chalk.bold(`\n  Total: ${totalChanges} change(s)\n`));

  // Changes by layer
  const changesByLayer = groupChangesByLayer(plan);

  if (Object.keys(changesByLayer).length > 0) {
    console.log(chalk.cyan("Changes by layer:\n"));

    Object.entries(changesByLayer).forEach(([layer, stats]) => {
      const layerTotal = stats.create + stats.update + stats.delete;
      if (layerTotal > 0) {
        console.log(chalk.bold(`  ${layer.toUpperCase()}:`));

        if (stats.create > 0) {
          console.log(chalk.green(`    ➕ Create: ${stats.create}`));
        }
        if (stats.update > 0) {
          console.log(chalk.yellow(`    🔄 Update: ${stats.update}`));
        }
        if (stats.delete > 0) {
          console.log(chalk.red(`    🗑️  Delete: ${stats.delete}`));
        }
      }
    });

    console.log();
  }

  // Detailed resource list (if --show-resources)
  if (options.showResources) {
    console.log(chalk.cyan("Resources:\n"));

    const resourcesByAction = {
      create: plan.resources.filter((r) => r.action === "create"),
      update: plan.resources.filter((r) => r.action === "update"),
      delete: plan.resources.filter((r) => r.action === "delete"),
    };

    if (resourcesByAction.create.length > 0) {
      console.log(chalk.green("  Create:\n"));
      resourcesByAction.create.forEach((r) => {
        console.log(chalk.gray(`    ➕ ${r.type} - ${r.id} (${r.layer})`));
      });
      console.log();
    }

    if (resourcesByAction.update.length > 0) {
      console.log(chalk.yellow("  Update:\n"));
      resourcesByAction.update.forEach((r) => {
        console.log(chalk.gray(`    🔄 ${r.type} - ${r.id} (${r.layer})`));
      });
      console.log();
    }

    if (resourcesByAction.delete.length > 0) {
      console.log(chalk.red("  Delete:\n"));
      resourcesByAction.delete.forEach((r) => {
        console.log(chalk.gray(`    🗑️  ${r.type} - ${r.id} (${r.layer})`));
      });
      console.log();
    }
  }

  // Execution order (if --show-execution-order)
  if (options.showExecutionOrder && plan.execution_order.length > 0) {
    console.log(chalk.cyan("Execution order:\n"));

    plan.execution_order.forEach((group, index) => {
      console.log(chalk.bold(`  Stage ${index + 1}:`));
      group.forEach((resourceId) => {
        const resource = plan.resources.find((r) => r.id === resourceId);
        if (resource) {
          const icon = getActionIcon(resource.action);
          console.log(chalk.gray(`    ${icon} ${resourceId} (${resource.type})`));
        }
      });
      console.log();
    });
  }
}
```

### ✅ 6. Fonctions utilitaires

```typescript
/**
 * Group changes by layer
 */
function groupChangesByLayer(plan: InfrastructurePlan): Record<
  string,
  { create: number; update: number; delete: number; noChange: number }
> {
  const layers: Record<string, { create: number; update: number; delete: number; noChange: number }> = {};

  plan.resources.forEach((resource) => {
    if (!layers[resource.layer]) {
      layers[resource.layer] = { create: 0, update: 0, delete: 0, noChange: 0 };
    }

    switch (resource.action) {
      case "create":
        layers[resource.layer].create++;
        break;
      case "update":
        layers[resource.layer].update++;
        break;
      case "delete":
        layers[resource.layer].delete++;
        break;
      case "no-op":
        layers[resource.layer].noChange++;
        break;
    }
  });

  return layers;
}

/**
 * Get icon for action
 */
function getActionIcon(action: string): string {
  switch (action) {
    case "create":
      return "➕";
    case "update":
      return "🔄";
    case "delete":
      return "🗑️";
    default:
      return "➖";
  }
}
```

### ✅ 7. Suggestions des prochaines étapes

```typescript
console.log(chalk.blue("Next steps:"));
console.log(chalk.gray(`  • Review plan:  soverstack plan ${platformYaml} --show-resources`));
console.log(chalk.gray(`  • Visualize:    soverstack graph ${platformYaml} --type plan --open`));
console.log(chalk.gray(`  • Apply:        soverstack apply ${platformYaml}\n`));
```

---

## Exemples d'Utilisation

### Générer un plan basique

```bash
soverstack plan platform.yaml
```

**Output:**
```
📋 Soverstack Plan

✅ Validation passed

✅ Execution plan loaded

📊 Execution Plan Summary

Environment:
  • Infrastructure tier: production
  • Environment: prod
  • Generated at: 1/6/2026, 10:30:00 AM

Changes:

  ➕ 12 resource(s) to create
  🔄 3 resource(s) to update
  🗑️  1 resource(s) to delete

  Total: 16 change(s)

Changes by layer:

  DATACENTER:
    ➕ Create: 3
    🔄 Update: 1

  COMPUTE:
    ➕ Create: 8

  CLUSTER:
    ➕ Create: 1
    🗑️  Delete: 1

📄 Plan saved to: D:\project\.soverstack\plan.yaml

Next steps:
  • Review plan:  soverstack plan platform.yaml --show-resources
  • Visualize:    soverstack graph platform.yaml --type plan --open
  • Apply:        soverstack apply platform.yaml
```

### Afficher les ressources détaillées

```bash
soverstack plan platform.yaml --show-resources
```

**Output includes:**
```
Resources:

  Create:

    ➕ proxmox_server - server.pve1 (datacenter)
    ➕ proxmox_server - server.pve2 (datacenter)
    ➕ vm - vm.k8s-master-1 (compute)
    ...

  Update:

    🔄 proxmox_cluster - datacenter.pve-cluster (datacenter)

  Delete:

    🗑️  k8s_worker - k8s_worker.old-node (cluster)
```

### Afficher l'ordre d'exécution

```bash
soverstack plan platform.yaml --show-execution-order
```

**Output includes:**
```
Execution order:

  Stage 1:
    ➕ server.pve1 (proxmox_server)
    ➕ server.pve2 (proxmox_server)
    ➕ network.main (network_bridge)

  Stage 2:
    ➕ vm.k8s-master-1 (vm)
    ➕ vm.k8s-worker-1 (vm)

  Stage 3:
    ➕ k8s_master.k8s-master-1 (k8s_master)

  Stage 4:
    ➕ k8s_worker.k8s-worker-1 (k8s_worker)
```

### Générer avec validation verbose

```bash
soverstack plan platform.yaml --verbose
```

Affiche les détails complets de la validation avant le plan.

### Exporter en JSON

```bash
soverstack plan platform.yaml --json > plan.json
```

---

## Changements dans les Imports

```typescript
// AVANT
import { Command } from "commander";
import chalk from "chalk";
import { LayerType } from "@/types";
import ora from "ora";
import { validateInfrastructure, ValidateOptions } from "../validate/logic";
import { formatValidationJson, formatValidationResult } from "../validate/utils";

// APRÈS
import { Command } from "commander";
import chalk from "chalk";
import { LayerType } from "@/types";
import ora from "ora";
import path from "path";  // ✅ Ajouté
import fs from "fs";      // ✅ Ajouté
import { validateInfrastructure, ValidateOptions } from "../validate/logic";
import { formatValidationJson, formatValidationResult } from "../validate/utils";
import { loadPlan, InfrastructurePlan } from "../validate/utils/plan-generator";  // ✅ Ajouté
```

---

## Résumé des Améliorations

| Amélioration | Status |
|--------------|--------|
| Messages clairs et complets | ✅ |
| Vérification existence fichier | ✅ |
| Résumé du plan affiché | ✅ |
| Changes regroupés par layer | ✅ |
| Option --show-resources | ✅ |
| Option --show-execution-order | ✅ |
| Suggestions next steps | ✅ |
| Meilleure gestion d'erreurs | ✅ |
| Affichage chemin du plan | ✅ |
| Nettoyage code inutile | ✅ |

---

## Impact Utilisateur

### Avant
```bash
$ soverstack plan platform.yaml
Pla...
✅ Validation results
[Full validation output with lots of details]
```
Utilisateur ne sait pas:
- Combien de ressources seront créées
- Où le plan a été sauvegardé
- Quoi faire ensuite

### Après
```bash
$ soverstack plan platform.yaml

📋 Soverstack Plan

✅ Validation passed

📊 Execution Plan Summary

Environment:
  • Infrastructure tier: production
  • Generated at: 1/6/2026, 10:30:00 AM

Changes:

  ➕ 12 resource(s) to create
  🔄 3 resource(s) to update

  Total: 15 change(s)

Changes by layer:

  DATACENTER:
    ➕ Create: 3
  COMPUTE:
    ➕ Create: 8
  CLUSTER:
    ➕ Create: 1
    🔄 Update: 3

📄 Plan saved to: .soverstack/plan.yaml

Next steps:
  • Review plan:  soverstack plan platform.yaml --show-resources
  • Visualize:    soverstack graph platform.yaml --type plan --open
  • Apply:        soverstack apply platform.yaml
```

Utilisateur comprend immédiatement:
- ✅ Combien de ressources impactées
- ✅ Quel type de changements (create/update/delete)
- ✅ Répartition par layer
- ✅ Où trouver le plan
- ✅ Quoi faire ensuite

---

## Conclusion

Ces améliorations transforment la commande `plan` d'un simple validateur en un outil interactif et informatif qui guide l'utilisateur à travers le workflow d'infrastructure:

**validate** → **plan** ✨ → **graph** → **apply**

Le plan devient le point central de prise de décision, avec toutes les informations nécessaires affichées clairement.
