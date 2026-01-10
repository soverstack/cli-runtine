# Build et Déploiement - Runtime Docker

Guide complet pour builder, tester et déployer l'image Docker du runtime.

---

## 🎯 Objectif

Au lieu que le launcher compile/exécute le code TypeScript, il **appelle directement une image Docker** :

```
Launcher → docker run soverstack/runtime:v1.0.0 validate platform.yaml
```

L'image Docker contient :
- ✅ Runtime Node.js 18
- ✅ CLI Soverstack (compilé)
- ✅ Ansible
- ✅ Terraform
- ✅ Tous les playbooks et modules

---

## 📦 Images Disponibles

### 1. Image Production (`Dockerfile`)

```bash
# Build
docker build -t soverstack/runtime:latest .

# Taille: ~300 MB
# Contient: Node.js + Ansible + Terraform + CLI compilé
```

**Utilisation** :
```bash
docker run --rm \
  -v $PWD:/workspace \
  soverstack/runtime:latest \
  validate platform.yaml
```

---

### 2. Image Dev (`Dockerfile.dev`)

```bash
# Build
docker build -f Dockerfile.dev -t soverstack/runtime:dev .

# Taille: ~400 MB (inclut dev dependencies)
# Contient: Tout + nodemon pour hot reload
```

**Utilisation** :
```bash
# Avec docker-compose (recommandé)
docker-compose up runtime-dev

# Les changements dans src/ sont automatiquement détectés
```

---

## 🏗️ Build

### Build Simple

```bash
# Production
make build

# Dev
make build-dev
```

---

### Build avec Version

```bash
# Définir la version
export VERSION=1.0.0

# Build avec tag
docker build -t soverstack/runtime:$VERSION .
docker tag soverstack/runtime:$VERSION soverstack/runtime:latest
```

---

### Build Multi-Platform (ARM + x64)

```bash
# Setup buildx
docker buildx create --name multiarch --use

# Build pour multiple plateformes
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t soverstack/runtime:latest \
  --push \
  .
```

---

## 🚀 Utilisation

### 1. Mode Production

```bash
# Valider une configuration
docker run --rm \
  -v $PWD:/workspace \
  soverstack/runtime:latest \
  validate platform.yaml

# Générer un plan
docker run --rm \
  -v $PWD:/workspace \
  soverstack/runtime:latest \
  plan

# Appliquer
docker run --rm \
  -v $PWD:/workspace \
  -e AWS_ACCESS_KEY_ID \
  -e AWS_SECRET_ACCESS_KEY \
  soverstack/runtime:latest \
  apply
```

---

### 2. Mode Dev avec Hot Reload

```bash
# Démarrer en mode dev
docker-compose up runtime-dev

# Dans un autre terminal, modifier src/
# Les changements sont automatiquement rechargés !
```

**Workflow dev** :
1. `docker-compose up runtime-dev`
2. Modifier `src/commands/validate/index.ts`
3. Nodemon détecte le changement et redémarre
4. Tester : `docker-compose exec runtime-dev node dist/index.js validate`

---

## 🔄 CI/CD - Auto-Build sur Git Push

### GitHub Actions

```yaml
# .github/workflows/build-runtime.yml
name: Build Runtime Docker Image

on:
  push:
    branches: [main]
    paths:
      - 'runtine-nodejs/**'

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v2

      - name: Login to GitHub Container Registry
        uses: docker/login-action@v2
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract version
        id: version
        run: echo "VERSION=$(cat package.json | jq -r .version)" >> $GITHUB_OUTPUT

      - name: Build and push
        uses: docker/build-push-action@v4
        with:
          context: ./runtine-nodejs
          platforms: linux/amd64,linux/arm64
          push: true
          tags: |
            ghcr.io/soverstack/runtime:latest
            ghcr.io/soverstack/runtime:${{ steps.version.outputs.VERSION }}
```

---

### GitLab CI

```yaml
# .gitlab-ci.yml
build-runtime:
  stage: build
  image: docker:latest
  services:
    - docker:dind
  script:
    - cd runtine-nodejs
    - docker build -t $CI_REGISTRY/soverstack/runtime:$CI_COMMIT_SHA .
    - docker tag $CI_REGISTRY/soverstack/runtime:$CI_COMMIT_SHA $CI_REGISTRY/soverstack/runtime:latest
    - docker push $CI_REGISTRY/soverstack/runtime:$CI_COMMIT_SHA
    - docker push $CI_REGISTRY/soverstack/runtime:latest
  only:
    changes:
      - runtine-nodejs/**
```

---

## 🔗 Integration avec le Launcher

### Avant (Launcher compilait le code)

```typescript
// launcher-nodejs/src/main.ts (ANCIEN)
import { runContainer } from './internal/docker/container';

await runContainer({
  image: 'soverstack/runtime:v1.0.0',
  args: ['validate', 'platform.yaml'],
  // ...
});
```

**Problème** : Le launcher devait :
- Monter le code source
- Compiler TypeScript
- Gérer node_modules

---

### Après (Launcher appelle l'image)

```typescript
// launcher-nodejs/src/main.ts (NOUVEAU)
import { runContainer } from './internal/docker/container';

const runtimeVersion = extractVersion(args); // "v1.0.0"
const imageName = `soverstack/runtime:${runtimeVersion}`;

// Pull l'image si nécessaire
await pullImage(imageName);

// Run directement l'image
await runContainer({
  image: imageName, // ← Image avec TOUT dedans
  args: args,
  envVars: envArray,
  workDir: cwd,
});
```

**Équivalent Docker CLI** :
```bash
docker run --rm \
  -v /home/user/project:/workspace \
  -e AWS_ACCESS_KEY_ID \
  -e AWS_SECRET_ACCESS_KEY \
  soverstack/runtime:v1.0.0 \
  validate platform.yaml
```

**Avantages** :
- ✅ Pas de compilation à chaque run
- ✅ Image immuable et versionnée
- ✅ Reproductible
- ✅ Plus rapide

---

## 📊 Comparaison

| Aspect | Avant (Code Monté) | Après (Image Docker) |
|--------|-------------------|---------------------|
| **Démarrage** | ~2-5s (compile TS) | ~0.5s (déjà compilé) |
| **Taille** | node_modules ~100 MB | Image ~300 MB (cached) |
| **Reproductibilité** | ⚠️ Dépend de Node.js local | ✅ Totale |
| **Versioning** | ⚠️ Difficile | ✅ Facile (tags) |
| **CI/CD** | ⚠️ Complexe | ✅ Simple |

---

## 🛡️ Sécurité

### Scan de Vulnérabilités

```bash
# Avec Trivy
docker run --rm \
  -v /var/run/docker.sock:/var/run/docker.sock \
  aquasec/trivy image \
  soverstack/runtime:latest

# Avec Snyk
snyk container test soverstack/runtime:latest
```

---

### Signature des Images

```bash
# Avec Docker Content Trust
export DOCKER_CONTENT_TRUST=1

docker push soverstack/runtime:v1.0.0
# L'image est automatiquement signée
```

---

## 🎯 Workflow Recommandé

### 1. Développement Local

```bash
# Terminal 1: Dev mode
cd runtine-nodejs
docker-compose up runtime-dev

# Terminal 2: Modifier le code
vim src/commands/validate/index.ts

# Terminal 3: Tester
docker-compose exec runtime-dev node dist/index.js validate
```

---

### 2. Build pour Test

```bash
# Build l'image de test
make build

# Tester localement
make run ARGS="validate examples/platform.yaml"
```

---

### 3. Push en Production

```bash
# Tag avec version
docker tag soverstack/runtime:latest soverstack/runtime:v1.0.0

# Push vers registry
make push
```

---

### 4. Launcher Utilise l'Image

```bash
# L'utilisateur lance :
soverstack validate platform.yaml

# Le launcher fait automatiquement :
docker pull soverstack/runtime:v1.0.0  # Si pas en cache
docker run --rm \
  -v $PWD:/workspace \
  soverstack/runtime:v1.0.0 \
  validate platform.yaml
```

---

## 📚 Commandes Utiles

```bash
# Voir les images
docker images | grep soverstack

# Inspecter l'image
docker inspect soverstack/runtime:latest

# Tester l'image
docker run --rm soverstack/runtime:latest --version

# Entrer dans l'image
docker run -it --rm --entrypoint /bin/bash soverstack/runtime:latest

# Voir les layers
docker history soverstack/runtime:latest

# Nettoyer
docker rmi soverstack/runtime:latest
docker system prune -a
```

---

## 🎓 Next Steps

1. ✅ Build l'image : `make build`
2. ✅ Tester localement : `make run ARGS="--help"`
3. ✅ Setup CI/CD pour auto-build
4. ✅ Mettre à jour le launcher pour utiliser l'image
5. ✅ Publier sur un registry (GitHub, GitLab, DockerHub)

---

**L'image Docker rend le runtime immuable, versionné et reproductible** ! 🚀
