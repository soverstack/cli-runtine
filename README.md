# Soverstack Runtime - Node.js/TypeScript

Runtime Docker pour Soverstack - Le cerveau qui orchestre l'infrastructure.

---

## 🎯 Vue d'Ensemble

Le **runtime** est le CLI Node.js qui s'exécute **dans le container Docker**. Il :

1. ✅ Valide les configurations YAML
2. ✅ Génère les inventaires Ansible et tfvars Terraform
3. ✅ Orchestre Ansible et Terraform
4. ✅ Gère l'état de l'infrastructure
5. ✅ Assure la sécurité et la conformité

```
┌─────────────────────────────────────────────────────────────┐
│                     MACHINE HÔTE                            │
│                                                             │
│  Launcher → Docker Container → Runtime (Node.js)           │
│                                      ↓                      │
│                          [ Ansible + Terraform ]            │
└─────────────────────────────────────────────────────────────┘
```

---

## 📁 Structure du Projet

```
runtine-nodejs/
├── type.ts                    # ⭐ Définitions TypeScript (LIRE EN PREMIER)
├── README.md                  # Documentation (ce fichier)
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts               # Point d'entrée du CLI
    ├── commands/              # Implémentation des commandes
    │   ├── init/              # soverstack init
    │   ├── validate/          # soverstack validate
    │   ├── plan/              # soverstack plan
    │   ├── apply/             # soverstack apply
    │   ├── destroy/           # soverstack destroy
    │   ├── dns-update/        # soverstack dns:update
    │   ├── graph/             # soverstack graph
    │   └── generate-ssh/      # soverstack generate:ssh-keys
    ├── validators/            # Validation des schémas YAML
    ├── generators/            # Génération Ansible/Terraform
    ├── secrets/               # Secrets management (Vault, SOPS)
    └── utils/                 # Utilitaires
```

---

## 🔒 SÉCURITÉ - RÈGLES CRITIQUES

### ❌ INTERDICTIONS ABSOLUES

1. **JAMAIS de mots de passe en clair** dans les fichiers YAML
2. **JAMAIS de clés SSH privées** dans le repo Git
3. **JAMAIS de secrets** committés dans Git

### ✅ BONNES PRATIQUES OBLIGATOIRES

#### 1. Utiliser des Variables d'Environnement

```yaml
# ❌ MAUVAIS - Mot de passe en clair
servers:
  - name: srv1
    root_password: "mypassword123"

# ✅ BON - Référence à une variable d'environnement
servers:
  - name: srv1
    root_password_env_var: "ROOT_PASSWORD_SRV1"
```

**Utilisation** :

```bash
export ROOT_PASSWORD_SRV1="mypassword123"
soverstack apply
```

---

#### 2. Utiliser Vault (Recommandé pour Production)

```yaml
# platform.yaml
secrets:
  provider: "vault"
  vault_address: "https://vault.example.com"
  vault_token_env_var: "VAULT_TOKEN"

# datacenter.yaml
servers:
  - name: srv1
    root_password_vault_path: "secret/data/servers/srv1/root_password"
```

**Utilisation** :

```bash
export VAULT_TOKEN="s.abc123..."
soverstack apply
```

---

#### 3. Utiliser SOPS pour Chiffrer les Fichiers

```bash
# Chiffrer un fichier
sops -e datacenter.yaml > datacenter.enc.yaml

# Utiliser avec Soverstack
sops -d datacenter.enc.yaml | soverstack validate
```

**`.gitignore`** :

```
# Secrets
.soverstack/secrets/
*.enc.yaml
ssh/id_rsa
ssh/id_rsa.pub
```

---

## 📊 Architecture - Mode Simple vs Avancé

### Mode Simple (Recommandé pour Débuter)

**Un seul fichier pour tout** :

```
my-project/
├── soverstack-simple.yaml    # Toute la config ici
└── .soverstack/
    ├── state.json
    └── audit.log
```

**soverstack-simple.yaml** :

```yaml
name: my-project
version: "1.0.0"
environment: prod
domain: example.com

datacenters:
  - name: dc-prod
    servers:
      - name: srv1
        ip: 10.0.0.1
        # ...

computes:
  - name: web-servers
    virtual_machines:
      - name: web-1
        # ...

features:
  monitoring:
    enabled: true
    # ...
```

---

### Mode Avancé (Recommandé pour Production)

**Fichiers séparés par layer** :

```
my-project/
├── platform.yaml              # Config principale
├── .soverstack/
│   ├── state.json             # État actuel
│   ├── audit.log              # Logs d'audit
│   └── secrets/               # Secrets chiffrés (SOPS)
│       ├── root-passwords.enc.yaml
│       └── ssh-keys.enc.yaml
├── layers/
│   ├── datacenters/
│   │   ├── dc-prod.yaml
│   │   └── dc-dev.yaml
│   ├── computes/
│   │   └── compute-prod.yaml
│   ├── clusters/
│   │   └── k8s-prod.yaml
│   └── features/
│       └── features-prod.yaml
└── .gitignore
```

**platform.yaml** :

```yaml
name: my-project
version: "1.0.0"
environment: prod
domain: example.com

secrets:
  provider: "vault"
  vault_address: "https://vault.example.com"

layers:
  datacenter: layers/datacenters/dc-prod.yaml
  compute: layers/computes/compute-prod.yaml
  clusters: layers/clusters/k8s-prod.yaml
  features: layers/features/features-prod.yaml
```

---

## 🚀 Commandes Disponibles

### Initialisation

```bash
# Créer un nouveau projet
soverstack init my-project

# Générer des clés SSH
soverstack generate:ssh-keys
```

---

### Validation

```bash
# Valider toute la configuration
soverstack validate

# Valider un layer spécifique
soverstack validate datacenter dc-prod
soverstack validate compute web-servers
soverstack validate cluster k8s-prod
soverstack validate feature monitoring
```

---

### Planification

```bash
# Voir les changements à appliquer
soverstack plan

# Plan pour un layer spécifique
soverstack plan datacenter dc-prod

# Dry-run (preview sans appliquer)
soverstack apply --dry-run
```

**Output exemple** :

```
Plan Summary:
  + Create: 5 VMs
  ~ Update: 2 VMs (ip change)
  - Delete: 1 VM

Changes:
  [+] vm-web-1 (ip: 10.0.1.10, host: srv1)
  [~] vm-db-1 (ip: 10.0.1.20 → 10.0.1.25)
  [-] vm-old-1

Estimated duration: 5m30s
Continue? [y/N]
```

---

### Application

```bash
# Appliquer toute l'infrastructure
soverstack apply

# Appliquer un layer spécifique
soverstack apply datacenter dc-prod
soverstack apply compute web-servers
soverstack apply cluster k8s-prod
soverstack apply feature monitoring
```

---

### Destruction

```bash
# ⚠️ Détruire TOUTE la plateforme
soverstack destroy

# Détruire un layer spécifique
soverstack destroy feature monitoring
soverstack destroy cluster k8s-prod
soverstack destroy compute web-servers
soverstack destroy datacenter dc-prod
```

**⚠️ Règles de dépendances** :

- Impossible de destroy un datacenter si des compute/clusters en dépendent
- Impossible de destroy un cluster si des features en dépendent
- Ordre recommandé : features → clusters → computes → datacenter

---

### Visualisation

```bash
# Graph complet des dépendances
soverstack graph

# Graph détaillé
soverstack graph:all

# Graph d'un layer spécifique
soverstack graph:datacenter dc-prod
soverstack graph:cluster k8s-prod
```

**Output exemple** :

```
Platform: my-project
  ├── Datacenter: dc-prod
  │   ├── Cluster: k8s-prod (depends on dc-prod)
  │   │   └── Features: monitoring (depends on k8s-prod)
  │   └── Compute: web-servers (depends on dc-prod)
  └── Firewall: opnsense (depends on dc-prod)

⚠️ Cannot destroy dc-prod: 3 dependent resources
```

---

### DNS

```bash
# Mettre à jour les nameservers DNS
soverstack dns:update
```

---

## 🔄 Workflow Complet

### 1. Initialisation

```bash
# Créer le projet
soverstack init my-project
cd my-project

# Générer des clés SSH
soverstack generate:ssh-keys
```

**Résultat** :

```
my-project/
├── platform.yaml
├── layers/
│   ├── datacenters/dc-prod.yaml
│   ├── computes/compute-prod.yaml
│   └── features/features-prod.yaml
└── .soverstack/
```

---

### 2. Configuration

Éditer `platform.yaml` et les layers selon vos besoins.

**Exemple datacenter** :

```yaml
# layers/datacenters/dc-prod.yaml
name: dc-prod
servers:
  - name: srv1
    id: 123
    ip: 10.0.0.1
    port: 22
    root_password_env_var: "ROOT_PASSWORD_SRV1"
    os: proxmox
    disk_encryption:
      enabled: true
      pass_key_env_var: "DISK_KEY_SRV1"
```

---

### 3. Validation

```bash
# Valider la configuration
soverstack validate

# Output:
# ✅ Platform configuration is valid
# ✅ Datacenter dc-prod is valid
# ✅ Compute web-servers is valid
# ✅ All layers validated successfully
```

---

### 4. Planification

```bash
# Voir ce qui va être créé
soverstack plan

# Output:
# Plan Summary:
#   + Create: 5 VMs, 1 Cluster
#   ~ Update: 0
#   - Delete: 0
#
# Estimated duration: 8m15s
```

---

### 5. Application (Dry-Run d'abord)

```bash
# Preview des changements
soverstack apply --dry-run

# Si OK, appliquer pour de vrai
soverstack apply
```

---

### 6. Visualisation

```bash
# Voir le graph de l'infrastructure
soverstack graph:all
```

---

## 📦 Types TypeScript

Voir le fichier `type.ts` pour toutes les interfaces TypeScript.

**Types principaux** :

- `Platform` - Configuration principale
- `Datacenter` - Serveurs physiques
- `Compute` - VMs et conteneurs
- `K8sCluster` - Cluster Kubernetes
- `Feature` - Applications (monitoring, GitLab, etc.)
- `SSHKeys` - Clés SSH
- `State` - État de l'infrastructure
- `Plan` - Résumé des changements

---

## 🛡️ Checklist Sécurité

Avant de déployer en production :

- [ ] ❌ Aucun mot de passe en clair dans les YAML
- [ ] ❌ Aucune clé SSH privée dans le repo
- [ ] ✅ Tous les secrets dans des variables d'environnement ou Vault
- [ ] ✅ `.gitignore` contient `.soverstack/secrets/`
- [ ] ✅ Fichiers sensibles chiffrés avec SOPS
- [ ] ✅ `accessibleOutsideVPN: false` pour services critiques
- [ ] ✅ Validation stricte activée
- [ ] ✅ Audit log activé
- [ ] ✅ Dry-run testé avant apply

---

## 🧪 Tests

```bash
# Valider tous les exemples
npm run test:validate

# Tester le plan
npm run test:plan

# Tester la génération Ansible/Terraform
npm run test:generate
```

---

## 🐛 Debugging

### Activer les logs détaillés

```bash
export SOVERSTACK_DEBUG=true
soverstack validate
```

### Voir les fichiers générés

```bash
# Les inventaires Ansible et tfvars sont dans :
.soverstack/generated/
├── ansible/
│   ├── inventory.yml
│   └── vars.yml
└── terraform/
    ├── main.tf
    └── terraform.tfvars
```

---

## 📚 Documentation Complète

- **Types** : Voir `type.ts` avec tous les commentaires
- **Launcher** : Voir `../launcher-nodejs/README.md`
- **Architecture** : Voir `../launcher-nodejs/ARCHITECTURE-COMPLETE.md`
- **Secrets** : Voir section "Sécurité" ci-dessus

---

## 🎯 Next Steps

1. Lire `type.ts` pour comprendre les types
2. Implémenter les commandes dans `src/commands/`
3. Ajouter la validation des schémas avec Zod
4. Implémenter le secrets management (Vault/SOPS)
5. Créer les générateurs Ansible/Terraform
6. Ajouter les tests

---

**Prêt pour l'implémentation !** 🚀

Pour toute question, voir la documentation complète ou les exemples dans `examples/`.
