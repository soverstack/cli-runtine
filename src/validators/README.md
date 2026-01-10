# Validators

Ce dossier contient les validators pour les différentes configurations Soverstack.

## Structure

- `platform.validator.ts` - Validation de platform.yaml
- `datacenter.validator.ts` - Validation des datacenters
- `compute.validator.ts` - Validation des computes
- `cluster.validator.ts` - Validation des clusters K8s
- `feature.validator.ts` - Validation des features
- `secrets.validator.ts` - Validation de la sécurité (pas de mots de passe en clair)

## Usage

```typescript
import { validatePlatform } from './validators/platform.validator';

const platform = loadPlatform('./platform.yaml');
const result = validatePlatform(platform);

if (!result.valid) {
  console.error(result.errors);
  process.exit(1);
}
```

## Utilisation de Zod

Tous les validators utilisent Zod pour la validation de schémas.

```typescript
import { z } from 'zod';

const PlatformSchema = z.object({
  name: z.string().min(1),
  version: z.string(),
  environment: z.string(),
  // ...
});
```
