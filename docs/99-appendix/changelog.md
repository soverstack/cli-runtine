# Changelog

Version history and release notes.

## Versioning

Soverstack follows [Semantic Versioning](https://semver.org/):
- **MAJOR**: Breaking changes
- **MINOR**: New features (backward compatible)
- **PATCH**: Bug fixes (backward compatible)

## Releases

### [Unreleased]

#### Added
- Initial documentation structure
- Type reference documentation
- Runbooks for common operations

#### Changed
- N/A

#### Fixed
- N/A

---

### [1.0.0] - TBD

#### Added
- Initial release
- Datacenter layer (Proxmox VE servers)
- Networking layer (VyOS, Headscale, PowerDNS)
- Compute layer (VMs and instance types)
- Database layer (PostgreSQL with Patroni)
- Cluster layer (Kubernetes with Cilium)
- Security layer (Keycloak, OpenBao)
- Observability layer (Prometheus, Grafana, Loki)
- Apps layer (application definitions)
- CLI commands (init, validate, plan, apply, destroy)
- Infrastructure tiers (local, production, enterprise)
- VM ID range validation
- HA requirements validation

---

## Template

```markdown
### [X.Y.Z] - YYYY-MM-DD

#### Added
- New features

#### Changed
- Changes in existing functionality

#### Deprecated
- Features to be removed in future

#### Removed
- Removed features

#### Fixed
- Bug fixes

#### Security
- Security fixes
```
