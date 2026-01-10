# ═══════════════════════════════════════════════════════════════════════════
# SOVERSTACK RUNTIME - DOCKER IMAGE
# ═══════════════════════════════════════════════════════════════════════════
#
# Image Docker pour le runtime Soverstack
# Cette image contient le CLI Node.js + Ansible + Terraform
#
# Usage:
#   docker build -t soverstack/runtime:latest .
#   docker run --rm -v $PWD:/workspace soverstack/runtime:latest validate
#
# ═══════════════════════════════════════════════════════════════════════════

# ───────────────────────────────────────────────────────────────────────────
# STAGE 1: Build - Compilation TypeScript
# ───────────────────────────────────────────────────────────────────────────
FROM node:18-alpine AS builder

WORKDIR /build

# Copier les fichiers de dépendances
COPY package*.json ./
COPY tsconfig.json ./

# Installer les dépendances
RUN npm ci

# Copier le code source
COPY src/ ./src/

# Compiler TypeScript → JavaScript
RUN npm run build

# ───────────────────────────────────────────────────────────────────────────
# STAGE 2: Runtime - Image finale avec Ansible + Terraform
# ───────────────────────────────────────────────────────────────────────────
FROM debian:bookworm-slim

# Métadonnées
LABEL maintainer="Soverstack <contact@soverstack.com>"
LABEL description="Soverstack Runtime - Infrastructure Orchestration"
LABEL version="1.0.0"

# Variables d'environnement
ENV NODE_VERSION=18 \
    TERRAFORM_VERSION=1.6.6 \
    ANSIBLE_VERSION=2.16.0 \
    DEBIAN_FRONTEND=noninteractive

# Installer les dépendances système
RUN apt-get update && apt-get install -y \
    # Node.js runtime
    curl \
    ca-certificates \
    gnupg \
    # Python pour Ansible
    python3 \
    python3-pip \
    # SSH client
    openssh-client \
    # Git (pour cloner des repos si nécessaire)
    git \
    # Utilitaires
    unzip \
    jq \
    && rm -rf /var/lib/apt/lists/*

# Installer Node.js 18
RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Installer Ansible
RUN pip3 install --no-cache-dir \
    ansible==${ANSIBLE_VERSION} \
    ansible-lint \
    jmespath \
    && rm -rf /root/.cache

# Installer Terraform
RUN curl -fsSL https://releases.hashicorp.com/terraform/${TERRAFORM_VERSION}/terraform_${TERRAFORM_VERSION}_linux_amd64.zip -o terraform.zip \
    && unzip terraform.zip \
    && mv terraform /usr/local/bin/ \
    && rm terraform.zip

# Créer la structure de répertoires
RUN mkdir -p /opt/soverstack/{cli,ansible,terraform,schemas}

# Copier le CLI compilé depuis le builder
COPY --from=builder /build/dist /opt/soverstack/cli/dist
COPY --from=builder /build/package.json /opt/soverstack/cli/
COPY --from=builder /build/node_modules /opt/soverstack/cli/node_modules

# Créer un lien symbolique pour le CLI
RUN ln -s /opt/soverstack/cli/dist/index.js /usr/local/bin/soverstack-cli \
    && chmod +x /opt/soverstack/cli/dist/index.js

# Configurer le répertoire de travail
WORKDIR /workspace

# Point d'entrée : le CLI Soverstack
ENTRYPOINT ["node", "/opt/soverstack/cli/dist/index.js"]

# Commande par défaut : --help
CMD ["--help"]

# Vérifications de santé
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -v && terraform version && ansible --version || exit 1
