# Generators

Ce dossier contient les générateurs pour Ansible et Terraform.

## Structure

- `ansible/` - Générateurs Ansible
  - `inventory.generator.ts` - Génération des inventaires
  - `vars.generator.ts` - Génération des variables
- `terraform/` - Générateurs Terraform
  - `tfvars.generator.ts` - Génération des tfvars
  - `main.generator.ts` - Génération du main.tf

## Usage

```typescript
import { generateAnsibleInventory } from './generators/ansible/inventory.generator';

const platform = loadPlatform('./platform.yaml');
const datacenter = loadLayer(platform, 'datacenter');

const inventory = generateAnsibleInventory(datacenter);

// Écrire dans .soverstack/generated/ansible/inventory.yml
fs.writeFileSync(inventoryPath, inventory);
```

## Output

Les fichiers générés sont placés dans :

```
.soverstack/generated/
├── ansible/
│   ├── inventory.yml
│   └── vars.yml
└── terraform/
    ├── main.tf
    └── terraform.tfvars
```
