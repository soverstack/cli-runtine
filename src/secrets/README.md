# Secrets Management

Ce dossier contient les modules de gestion des secrets.

## Providers supportés

- **Vault** - HashiCorp Vault
- **SOPS** - Mozilla SOPS
- **AWS Secrets Manager** - AWS
- **Env** - Variables d'environnement

## Structure

- `vault.provider.ts` - Integration Vault
- `sops.provider.ts` - Integration SOPS
- `aws.provider.ts` - Integration AWS Secrets Manager
- `env.provider.ts` - Variables d'environnement
- `secrets.manager.ts` - Manager unifié

## Usage

```typescript
import { SecretsManager } from './secrets/secrets.manager';

const secretsManager = new SecretsManager({
  provider: 'vault',
  vault_address: 'https://vault.example.com',
  vault_token_env_var: 'VAULT_TOKEN',
});

// Récupérer un secret
const password = await secretsManager.getSecret('secret/data/servers/srv1/root_password');

// Résoudre automatiquement les références
const resolvedConfig = await secretsManager.resolveSecrets(datacenter);
```

## Sécurité

⚠️ **JAMAIS de secrets en clair dans le code !**

✅ Toujours utiliser des références :
- `{{ vault:secret/path }}`
- `{{ env:VAR_NAME }}`
- `{{ sops:encrypted_value }}`
