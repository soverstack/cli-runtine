# ═══════════════════════════════════════════════════════════════════════════
# SOVERSTACK RUNTIME - MAKEFILE
# ═══════════════════════════════════════════════════════════════════════════

.PHONY: help build build-dev run run-dev clean test lint push

# Variables
IMAGE_NAME := soverstack/runtime
VERSION := $(shell cat package.json | grep version | head -1 | awk -F: '{ print $$2 }' | sed 's/[",]//g' | tr -d '[[:space:]]')
REGISTRY := ghcr.io/soverstack

# ───────────────────────────────────────────────────────────────────────────
# Help
# ───────────────────────────────────────────────────────────────────────────
help:
	@echo "Soverstack Runtime - Available commands:"
	@echo ""
	@echo "  make build          - Build production image"
	@echo "  make build-dev      - Build development image"
	@echo "  make run            - Run production image"
	@echo "  make run-dev        - Run development image with hot reload"
	@echo "  make test           - Run tests in container"
	@echo "  make lint           - Lint code"
	@echo "  make push           - Push image to registry"
	@echo "  make clean          - Clean build artifacts"
	@echo ""

# ───────────────────────────────────────────────────────────────────────────
# Build
# ───────────────────────────────────────────────────────────────────────────
build:
	@echo "🏗️  Building production image..."
	docker build -t $(IMAGE_NAME):latest -t $(IMAGE_NAME):$(VERSION) .
	@echo "✅ Build complete: $(IMAGE_NAME):$(VERSION)"

build-dev:
	@echo "🏗️  Building development image..."
	docker build -f Dockerfile.dev -t $(IMAGE_NAME):dev .
	@echo "✅ Build complete: $(IMAGE_NAME):dev"

# ───────────────────────────────────────────────────────────────────────────
# Run
# ───────────────────────────────────────────────────────────────────────────
run:
	@echo "🚀 Running production image..."
	docker run --rm -v $$(pwd):/workspace $(IMAGE_NAME):latest $(ARGS)

run-dev:
	@echo "🚀 Running development image with hot reload..."
	docker-compose up runtime-dev

# ───────────────────────────────────────────────────────────────────────────
# Test & Lint
# ───────────────────────────────────────────────────────────────────────────
test:
	@echo "🧪 Running tests..."
	docker run --rm -v $$(pwd):/workspace $(IMAGE_NAME):dev npm test

lint:
	@echo "🔍 Linting code..."
	docker run --rm -v $$(pwd):/workspace $(IMAGE_NAME):dev npm run lint

# ───────────────────────────────────────────────────────────────────────────
# Push to Registry
# ───────────────────────────────────────────────────────────────────────────
push:
	@echo "📤 Pushing to registry..."
	docker tag $(IMAGE_NAME):latest $(REGISTRY)/runtime:latest
	docker tag $(IMAGE_NAME):$(VERSION) $(REGISTRY)/runtime:$(VERSION)
	docker push $(REGISTRY)/runtime:latest
	docker push $(REGISTRY)/runtime:$(VERSION)
	@echo "✅ Pushed to $(REGISTRY)/runtime:$(VERSION)"

# ───────────────────────────────────────────────────────────────────────────
# Clean
# ───────────────────────────────────────────────────────────────────────────
clean:
	@echo "🧹 Cleaning..."
	rm -rf dist/ node_modules/ coverage/
	docker-compose down -v
	@echo "✅ Clean complete"

# ───────────────────────────────────────────────────────────────────────────
# Install
# ───────────────────────────────────────────────────────────────────────────
install:
	@echo "📦 Installing dependencies..."
	npm install
	@echo "✅ Dependencies installed"
