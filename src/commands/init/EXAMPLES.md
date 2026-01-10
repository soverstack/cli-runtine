# Init Command - Usage Examples

Guide pratique pour utiliser la commande `soverstack init` avec différents scénarios.

---

## 🎯 Scénarios d'Utilisation

### 1. Initialisation Simple (Sans Environnements)

Crée un projet avec des fichiers génériques sans suffixes d'environnement.

```bash
# Mode avancé (par défaut)
soverstack init my-project

# Résultat:
my-project/
├── platform.yaml
├── layers/
│   ├── datacenters/datacenter.yaml
│   ├── computes/compute.yaml
│   ├── clusters/k8s.yaml
│   └── features/features.yaml
└── ssh/
```

**platform.yaml généré:**

```yaml
layers:
  - datacenter: "./layers/datacenters/datacenter.yaml"
    compute: "./layers/computes/compute.yaml"
    cluster: "./layers/clusters/k8s.yaml"
    features: "./layers/features/features.yaml"
```

---

### 2. Initialisation avec Environnements

Crée des fichiers spécifiques pour chaque environnement.

```bash
# Un seul environnement
soverstack init my-project --env prod

# Plusieurs environnements
soverstack init my-project --env prod,dev,staging
```

**Résultat (3 environnements):**

```
my-project/
├── platform.yaml
├── layers/
│   ├── datacenters/
│   │   ├── dc-prod.yaml
│   │   ├── dc-dev.yaml
│   │   └── dc-staging.yaml
│   ├── computes/
│   │   ├── compute-prod.yaml
│   │   ├── compute-dev.yaml
│   │   └── compute-staging.yaml
│   ├── clusters/
│   │   ├── k8s-prod.yaml
│   │   ├── k8s-dev.yaml
│   │   └── k8s-staging.yaml
│   └── features/
│       ├── features-prod.yaml
│       ├── features-dev.yaml
│       └── features-staging.yaml
```

**platform.yaml généré:**

```yaml
layers:
  - datacenter: "./layers/datacenters/dc-prod.yaml"
    compute: "./layers/computes/compute-prod.yaml"
    cluster: "./layers/clusters/k8s-prod.yaml"
    features: "./layers/features/features-prod.yaml"
    environment: "prod"

  - datacenter: "./layers/datacenters/dc-dev.yaml"
    compute: "./layers/computes/compute-dev.yaml"
    cluster: "./layers/clusters/k8s-dev.yaml"
    features: "./layers/features/features-dev.yaml"
    environment: "dev"

  - datacenter: "./layers/datacenters/dc-staging.yaml"
    compute: "./layers/computes/compute-staging.yaml"
    cluster: "./layers/clusters/k8s-staging.yaml"
    features: "./layers/features/features-staging.yaml"
    environment: "staging"
```

---

### 3. Mode Simple

Utilise une architecture simplifiée avec un seul fichier par environnement.

```bash
# Sans environnement
soverstack init my-project --mode simple

# Avec environnements
soverstack init my-project --mode simple --env prod,dev
```

**Résultat (sans env):**

```
my-project/
├── platform.yaml
└── layers/
    └── infrastructure.yaml
```

**Résultat (avec env):**

```
my-project/
├── platform.yaml
└── layers/
    ├── infrastructure-prod.yaml
    └── infrastructure-dev.yaml
```

**platform.yaml (mode simple avec env):**

```yaml
mode: "simple"

infrastructure: "./layers/infrastructure-prod.yaml"
 
```

---

### 4. Génération de Clés SSH

Génère automatiquement une paire de clés SSH pour le projet.

```bash
soverstack init my-project --generate-ssh
```

**Résultat:**

```
my-project/
├── ssh/
│   ├── id_rsa          # Clé privée (NEVER COMMIT!)
│   └── id_rsa.pub      # Clé publique
```

**Note:** Les clés sont automatiquement ajoutées au `.gitignore`.

---

### 5. Mode Interactif

Si le nom du projet n'est pas fourni, une invite interactive apparaît.

```bash
soverstack init
```

**Invite:**

```
? Project name: (my-soverstack-project) █
```

---

## 📋 Comparaison des Scénarios

| Scénario            | Commande                                    | Fichiers Générés                            | Use Case                                         |
| ------------------- | ------------------------------------------- | ------------------------------------------- | ------------------------------------------------ |
| **Simple sans env** | `init my-proj --mode simple`                | 1 fichier                                   | Petits projets, test                             |
| **Simple avec env** | `init my-proj --mode simple --env prod,dev` | 1 fichier par env                           | Projets moyens avec peu de différences entre env |
| **Avancé sans env** | `init my-proj`                              | 4 fichiers (dc, compute, cluster, features) | Projets complexes mono-env                       |
| **Avancé avec env** | `init my-proj --env prod,dev,staging`       | 4 × 3 = 12 fichiers                         | Projets complexes multi-env                      |

---

## 🔍 Exemples Pratiques

### Cas 1: Startup avec 1 environnement

```bash
soverstack init startup-infra --env prod --generate-ssh
```

**Pourquoi?**

- Une seule production
- Pas de staging ni dev séparés
- Génération immédiate des clés SSH

---

### Cas 2: PME avec Dev/Staging/Prod

```bash
soverstack init company-infra --env dev,staging,prod --mode advanced
```

**Pourquoi?**

- Architecture complexe avec plusieurs datacenters
- Configuration différente par environnement
- Clusters K8s distincts

---

### Cas 3: Projet de Test Rapide

```bash
soverstack init test-project --mode simple
```

**Pourquoi?**

- Test rapide de Soverstack
- Configuration minimale
- Pas de multi-environnements

---

### Cas 4: SaaS Multi-Région

```bash
soverstack init saas-platform --env us-east,us-west,eu-central --mode advanced
```

**Pourquoi?**

- Environnements = régions géographiques
- Configuration complexe par région
- Isolation totale entre régions

---

## 🔒 Sécurité - Workflow Recommandé

### Étape 1: Initialisation

```bash
soverstack init my-project --env prod --generate-ssh
cd my-project
```

### Étape 2: Configuration des Secrets

**Option A: Variables d'Environnement**

Créer `.env` (jamais commit!):

```bash
cat > .env << 'EOF'
PROXMOX_API_URL=https://proxmox.example.com:8006/api2/json
PROXMOX_API_TOKEN=PVEAPIToken=user@pam!token=xxxx-xxxx-xxxx
ROOT_PASSWORD=SuperSecurePassword123!
EOF
```

**Option B: Vault**

```bash
# Stocker dans Vault
vault kv put secret/my-project/proxmox \
  api_url=https://proxmox.example.com:8006/api2/json \
  api_token=PVEAPIToken=user@pam!token=xxxx-xxxx-xxxx

vault kv put secret/my-project/vms \
  root_password=SuperSecurePassword123!
```

Puis dans `layers/datacenters/dc-prod.yaml`:

```yaml
credentials:
  vault_path: "secret/data/my-project/proxmox"
```

### Étape 3: Validation

```bash
# Charger les variables
export $(cat .env | xargs)

# Valider
soverstack validate platform.yaml
```

---

## 📊 Structure Générée Détaillée

### Mode Advanced avec Environnements

```
my-project/
├── platform.yaml                    # Configuration principale
│
├── layers/
│   ├── datacenters/
│   │   ├── dc-prod.yaml            # Provider, réseau, stockage (PROD)
│   │   ├── dc-dev.yaml             # Provider, réseau, stockage (DEV)
│   │   └── dc-staging.yaml         # Provider, réseau, stockage (STAGING)
│   │
│   ├── computes/
│   │   ├── compute-prod.yaml       # VMs (PROD)
│   │   ├── compute-dev.yaml        # VMs (DEV)
│   │   └── compute-staging.yaml    # VMs (STAGING)
│   │
│   ├── clusters/
│   │   ├── k8s-prod.yaml       # K8s cluster (PROD)
│   │   ├── k8s-dev.yaml        # K8s cluster (DEV)
│   │   └── k8s-staging.yaml    # K8s cluster (STAGING)
│   │
│   └── features/
│       ├── features-prod.yaml      # Monitoring, logging, etc. (PROD)
│       ├── features-dev.yaml       # Monitoring, logging, etc. (DEV)
│       └── features-staging.yaml   # Monitoring, logging, etc. (STAGING)
│
├── ssh/
│   ├── id_rsa                      # Clé privée (🔒 NEVER COMMIT!)
│   └── id_rsa.pub                  # Clé publique
│
├── .soverstack/
│   ├── state/                      # État Terraform/Ansible
│   ├── logs/                       # Logs d'exécution
│   └── cache/                      # Cache
│
├── .gitignore                      # Règles de sécurité
└── README.md                       # Documentation du projet
```

---

## ⚙️ Options Complètes

```bash
soverstack init [project-name] [options]

Arguments:
  project-name              Nom du projet (optionnel, invite interactive sinon)

Options:
  --env <environments>      Liste d'environnements séparés par des virgules
                            (optionnel, ex: prod,dev,staging)

  --mode <mode>             Mode du projet: simple ou advanced
                            (défaut: advanced)

  --generate-ssh            Générer les clés SSH automatiquement
                            (défaut: false)

  -h, --help               Afficher l'aide
```

---

## 🎓 Best Practices

### ✅ DO

- Utiliser `--env` pour séparer les environnements
- Utiliser mode `advanced` pour les projets complexes
- Générer les clés SSH avec `--generate-ssh`
- Créer un `.env` pour les secrets (ne pas commit!)
- Valider la configuration avant d'appliquer

### ❌ DON'T

- Ne pas commit les clés SSH privées
- Ne pas commit les `.env` files
- Ne pas utiliser des mots de passe en clair dans les YAML
- Ne pas mélanger les environnements dans un seul fichier
- Ne pas oublier de valider avant d'appliquer

---

## 🚀 Workflow Complet

```bash
# 1. Initialiser le projet
soverstack init my-infra --env prod,staging --generate-ssh
cd my-infra

# 2. Configurer les secrets
cat > .env << 'EOF'
PROXMOX_API_URL=https://proxmox.example.com:8006/api2/json
PROXMOX_API_TOKEN=PVEAPIToken=admin@pam!mytoken=xxxx
ROOT_PASSWORD=SecurePass123!
EOF

# 3. Charger les variables
export $(cat .env | xargs)

# 4. Personnaliser la configuration
vim layers/datacenters/dc-prod.yaml
vim layers/computes/compute-prod.yaml

# 5. Valider
soverstack validate platform.yaml

# 6. Générer le plan
soverstack plan

# 7. Appliquer
soverstack apply
```

---

**La commande `init` crée une structure propre et sécurisée, prête pour le déploiement!** 🎯
