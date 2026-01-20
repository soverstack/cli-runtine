# Glossary

Terms and definitions used in Soverstack documentation.

## A

### ArgoCD
GitOps continuous delivery tool for Kubernetes that syncs cluster state from Git repositories.

## B

### Bastion
A secure entry point to the infrastructure, typically running Headscale VPN for zero-trust access.

## C

### Ceph
Distributed storage system used for HA storage in Proxmox clusters.

### Cilium
eBPF-based CNI (Container Network Interface) for Kubernetes providing networking and security.

### Cloud-init
Industry standard for cross-platform cloud instance initialization, used for VM provisioning.

### CNI
Container Network Interface - specification for configuring network interfaces in Linux containers.

## D

### Datacenter
Physical infrastructure layer containing Proxmox VE servers.

### dnsdist
DNS load balancer that distributes queries across PowerDNS servers.

## E

### eBPF
Extended Berkeley Packet Filter - Linux kernel technology used by Cilium for high-performance networking.

### etcd
Distributed key-value store used by Kubernetes for cluster state and Patroni for leader election.

## F

### Floating IP
Virtual IP address that can failover between nodes using VRRP for high availability.

## G

### GitOps
Operational framework using Git as single source of truth for declarative infrastructure.

## H

### HA (High Availability)
System design approach ensuring services remain available despite component failures.

### Headscale
Open-source implementation of Tailscale control server for zero-trust VPN.

## I

### IAM
Identity and Access Management - systems managing user identities and permissions.

### Infrastructure Tier
Classification of deployment (local, production, enterprise) with different HA requirements.

## K

### Keycloak
Open-source identity and access management solution providing SSO/OIDC.

## L

### Layer
Logical grouping of infrastructure components (datacenter, compute, cluster, etc.).

### Loki
Log aggregation system designed to be cost-effective and easy to operate.

## M

### MetalLB
Kubernetes load balancer implementation for bare metal clusters.

## O

### OIDC
OpenID Connect - authentication layer built on OAuth 2.0.

### OpenBao
Open-source fork of HashiCorp Vault for secrets management.

## P

### Patroni
HA solution for PostgreSQL providing automatic failover and replication management.

### PowerDNS
Authoritative DNS server with database backend support.

### Proxmox VE
Open-source virtualization platform based on KVM and LXC.

## R

### Raft
Consensus algorithm used for distributed systems leader election.

## S

### SIEM
Security Information and Event Management - security monitoring and analysis.

### SSO
Single Sign-On - authentication allowing users to access multiple services with one login.

## T

### Traefik
Modern HTTP reverse proxy and load balancer for microservices.

## V

### Velero
Kubernetes backup and disaster recovery tool.

### VRRP
Virtual Router Redundancy Protocol - provides automatic router failover.

### VyOS
Open-source network operating system based on Debian for firewalls and routers.

## W

### Wazuh
Open-source security monitoring platform providing SIEM capabilities.

## Z

### Zero-Trust
Security model requiring all users and devices to be authenticated regardless of location.
