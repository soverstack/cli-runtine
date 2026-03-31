# Soverstack Runtime

The CLI that orchestrates sovereign infrastructure deployment. Runs inside a Docker container alongside Ansible and Terraform.

## Architecture

```
User → soverstack (Go launcher) → Docker container → Runtime (this) → Ansible/Terraform → Your servers
```

The runtime:

- Validates YAML configurations
- Computes execution plans (desired state vs current state)
- Generates Ansible artifacts (inventories, host_vars, VM definitions)
- Manages infrastructure state
- Handles SSH key generation and rotation

## Commands

```bash
soverstack init [project-name]              # Initialize a new project
soverstack validate [path] [-v]             # Validate project configuration
soverstack plan [path] [-v] [--debug]       # Show execution plan
soverstack apply [path] [-v] [--debug]      # Apply infrastructure changes
soverstack add region                       # Add a region to existing project
soverstack add zone                         # Add a zone to existing project
soverstack generate ssh [--all|--region|--dc]  # Generate/rotate SSH keys
```

## Project Structure

A Soverstack project looks like this after `soverstack init`:

```
my-project/
├── platform.yaml              # Global config (version, domain, tier, images)
├── .env                       # Bootstrap passwords (never commit)
├── .ssh/                      # SSH keys (never commit)
├── inventory/
│   └── <region>/
│       ├── region.yaml
│       └── datacenters/
│           ├── hub-<name>/    # Backup/storage datacenter
│           │   ├── nodes.yaml
│           │   ├── network.yaml
│           │   └── ssh.yaml
│           └── zone-<name>/   # Production compute datacenter
│               ├── nodes.yaml
│               ├── network.yaml
│               └── ssh.yaml
├── workloads/
│   ├── global/                # database, dns, secrets, identity, mesh
│   ├── regional/<region>/     # monitoring, bastion, siem
│   └── zonal/<region>/<dc>/   # firewall, loadbalancer, storage, backup
└── .soverstack/
    ├── state/state.json       # Infrastructure state
    ├── ansible/               # Generated Ansible artifacts
    └── logs/                  # Apply run logs
```

## Infrastructure Tiers

| Tier       | Nodes | HA                           | Use Case                |
| ---------- | ----- | ---------------------------- | ----------------------- |
| Local      | 1+    | Optional (warnings)          | Dev / Testing / Homelab |
| Production | 3+    | Required (errors)            | Production workloads    |
| Enterprise | 3+    | Required + network isolation | Mission-critical        |

## Development

### Prerequisites

- Node.js >= 18
- npm

### Setup

```bash
npm install
```

### Build

```bash
npm run build          # Bundle with esbuild → dist/index.js
npm run build:tsc      # TypeScript compilation (type checking)
```

### Run locally

```bash
npm run dev -- validate path/to/project
npm run dev -- init my-project
```

### Test

```bash
npm test               # Run all tests (81 tests, 4 suites)
npm run test:watch     # Watch mode
```

### Lint & Format

```bash
npm run lint
npm run format
```

## Docker Image

The runtime is packaged as a Docker image with Node.js, Ansible, and Terraform.

### Build

```bash
docker build -t ghcr.io/soverstack/cli-runtime:latest .
```

### Run

```bash
docker run --rm -v $PWD:/workspace ghcr.io/soverstack/cli-runtime:latest validate
```

### Tool Versions

All runtime tool versions are defined in `package.json` under `runtime`:

```json
"runtime": {
  "ansible_core": "2.16.0",
  "terraform": "1.6.6",
  "node": "18"
}
```

The Dockerfile reads these at build time — change versions in one place.

## CI/CD

GitHub Actions automatically builds and pushes the Docker image on every push to `main` or version tag.

```
Push to main     → ghcr.io/soverstack/cli-runtime:latest
Tag v1.0.0       → ghcr.io/soverstack/cli-runtime:v1.0.0
```

See `.github/workflows/build.yml`.

## How It Works

### Validation

Two-layer validation:

1. **Zod schemas** — structural validation (types, formats, required fields)
2. **Custom validators** — cross-file logic (HA requirements, reference integrity, uniqueness)

### Plan

Computes diff between desired state (YAML files) and current state (`state.json`):

- New nodes → bootstrap action
- Changed services → update/recreate action
- Removed services → destroy action

### Apply

1. Validate project
2. Compute plan
3. Generate Ansible artifacts in `.soverstack/ansible/`
4. Execute Ansible playbooks phase by phase
5. Update state after each successful action

Deploy order: Bootstrap → Global (DB → Vault → Identity → DNS → Mesh) → Regional → Zonal

### SSH Key Management

- 2 users per datacenter: admin + backup
- Safe rotation via `.ssh/.previous/` backup
- Keys must be deployed via `apply` before next rotation
- Key content hashed for change detection

### Credentials

Three types, used progressively:

| Type    | Source            | Phase       |
| ------- | ----------------- | ----------- |
| `env`   | `.env` file       | Bootstrap   |
| `file`  | `.ssh/` directory | Bootstrap   |
| `vault` | HashiCorp Vault   | Post-deploy |

## Source Layout

```
src/
├── index.ts                    # CLI entry point (Commander.js)
├── types.ts                    # Global type definitions
├── constants.ts                # HA requirements, VM ID ranges
├── utils/logger.ts             # Structured logging (default, -v, --debug)
└── commands/
    ├── init/                   # Project initialization + generators
    ├── validate/               # Schema + logic validation
    ├── plan/                   # State diffing + plan computation
    ├── apply/                  # Ansible artifact generation + execution
    ├── add/                    # Add regions/zones to existing projects
    └── generate/generate-ssh/  # SSH key generation + rotation
```

## License

AGPL-3.0 — See [LICENSE](./LICENSE)
