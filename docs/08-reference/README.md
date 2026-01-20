---
id: reference
title: Reference
sidebar_position: 1
---

# Reference Documentation

Complete reference for Soverstack configuration schemas and CLI commands.

## Contents

1. [Platform YAML Schema](./platform-yaml-schema.md) - Main configuration file
2. [Layer Schemas](./layer-schemas/) - Individual layer configurations
3. [Type Reference](./types/) - TypeScript type definitions
4. [VM ID Ranges](./vm-id-ranges.md) - Reserved VM ID ranges
5. [Infrastructure Requirements](./infrastructure-requirements.md) - Hardware specs
6. [CLI Commands](./cli-commands.md) - Command reference

## Type Reference

All configuration types are defined in `types.ts`. Each type has:
- Property table with types
- Required/optional indicators
- Default values
- Example usage

## Quick Links

### Core Types
- [Platform](./types/Platform.md) - Main platform configuration
- [Datacenter](./types/Datacenter.md) - Physical servers
- [ComputeConfig](./types/ComputeConfig.md) - Virtual machines

### Layer Types
- [NetworkingConfig](./types/NetworkingConfig.md) - Networking layer
- [DatabaseCluster](./types/DatabaseCluster.md) - Database configuration
- [K8sCluster](./types/K8sCluster.md) - Kubernetes cluster
- [SecurityConfig](./types/SecurityConfig.md) - Security services
- [AppsConfig](./types/AppsConfig.md) - Applications

### Utility Types
- [CredentialRef](./types/CredentialRef.md) - Secret references
- [FloatingIP](./types/FloatingIP.md) - Public IP configuration
- [VMRole](./types/VMRole.md) - VM role enumeration
