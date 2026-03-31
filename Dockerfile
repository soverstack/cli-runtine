# ═══════════════════════════════════════════════════════════════════════════
# SOVERSTACK RUNTIME - DOCKER IMAGE
# ═══════════════════════════════════════════════════════════════════════════
#
# Versions are defined in package.json under "runtime" and extracted at build time.
#
# Usage:
#   docker build -t ghcr.io/soverstack/runtime:latest .
#   docker run --rm -v $PWD:/workspace ghcr.io/soverstack/runtime:latest validate
#
# ═══════════════════════════════════════════════════════════════════════════

# ───────────────────────────────────────────────────────────────────────────
# STAGE 1: Build - Bundle avec esbuild
# ───────────────────────────────────────────────────────────────────────────
FROM node:18-alpine AS builder

WORKDIR /build

COPY package*.json ./
COPY tsconfig.json ./
COPY esbuild.config.mjs ./

# npm install (not ci) to resolve platform-specific binaries for linux
# package-lock.json may contain Windows-only esbuild binaries
RUN npm install --prefer-offline

COPY src/ ./src/

# Bundle → un seul fichier dist/index.js
RUN npm run build

# Extract versions from package.json for the runtime stage
RUN node -e " \
  const pkg = require('./package.json'); \
  const fs = require('fs'); \
  fs.writeFileSync('/tmp/versions.env', \
    'NODE_VERSION=' + pkg.runtime.node + '\n' + \
    'ANSIBLE_CORE_VERSION=' + pkg.runtime.ansible_core + '\n' + \
    'TERRAFORM_VERSION=' + pkg.runtime.terraform + '\n' + \
    'SOVERSTACK_VERSION=' + pkg.version + '\n' \
  );"

# ───────────────────────────────────────────────────────────────────────────
# STAGE 2: Runtime - Debian slim + Node.js + Ansible + Terraform
# ───────────────────────────────────────────────────────────────────────────
FROM debian:bookworm-slim

LABEL maintainer="Soverstack <contact@soverstack.com>"
LABEL description="Soverstack Runtime - Infrastructure Orchestration"

# Copy version file from builder
COPY --from=builder /tmp/versions.env /tmp/versions.env

ENV DEBIAN_FRONTEND=noninteractive

# Installer dépendances système en une seule couche
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    gnupg \
    python3 \
    python3-pip \
    openssh-client \
    git \
    unzip \
    jq \
    && rm -rf /var/lib/apt/lists/*

# Installer Node.js (version from package.json)
RUN . /tmp/versions.env \
    && curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

# Installer Ansible Core (version from package.json)
RUN . /tmp/versions.env \
    && pip3 install --no-cache-dir --break-system-packages \
    ansible-core==${ANSIBLE_CORE_VERSION} \
    jmespath

# Installer Terraform (version from package.json)
RUN . /tmp/versions.env \
    && curl -fsSL https://releases.hashicorp.com/terraform/${TERRAFORM_VERSION}/terraform_${TERRAFORM_VERSION}_linux_amd64.zip -o /tmp/terraform.zip \
    && unzip /tmp/terraform.zip -d /usr/local/bin/ \
    && rm /tmp/terraform.zip

# Cleanup
RUN rm /tmp/versions.env

# Copier le bundle unique (pas besoin de node_modules)
COPY --from=builder /build/dist/index.js /opt/soverstack/cli/index.js
RUN chmod +x /opt/soverstack/cli/index.js \
    && ln -s /opt/soverstack/cli/index.js /usr/local/bin/soverstack-cli

WORKDIR /workspace

ENTRYPOINT ["node", "/opt/soverstack/cli/index.js"]
CMD ["--help"]
