// ═══════════════════════════════════════════════════════════════════════════
// OBSERVABILITY LAYER - Monitoring, Audit & Compliance
// ═══════════════════════════════════════════════════════════════════════════
//
// This layer unifies three critical aspects of infrastructure operations:
// - Monitoring: Prometheus + Grafana + Loki (metrics, logs, visualization)
// - Audit: Falco + Auditd (security events, system calls, file integrity)
// - Compliance: Wazuh + OpenSCAP (PCI-DSS, GDPR, CIS benchmarks, vulnerability detection)
//
// Best open-source tools chosen for production-grade observability.
//
// ═══════════════════════════════════════════════════════════════════════════

export interface Observability {
  enabled: boolean;

  // ─────────────────────────────────────────────────────────────────────────
  // MONITORING STACK (Prometheus + Grafana + Loki)
  // ─────────────────────────────────────────────────────────────────────────
  monitoring?: {
    enabled: boolean;

    prometheus?: {
      enabled: boolean;
      retention_days: number; // Default: 15 days
      storage_size: string; // e.g., "50Gi"
      scrape_interval: string; // e.g., "30s"
      evaluation_interval: string; // e.g., "30s"
      vm_id?: number; // Optional: dedicated VM for Prometheus (recommended for production)

      // Node exporter for system metrics
      node_exporter: boolean; // Default: true

      // Service discovery
      kubernetes_sd: boolean; // Auto-discover k8s pods/services
      static_targets?: string[]; // Additional scrape targets
    };

    grafana?: {
      enabled: boolean;

      // ⚠️ SÉCURITÉ: Jamais de mot de passe en clair
      admin_password_env_var: string; // Required: e.g., "GRAFANA_ADMIN_PASSWORD"
      admin_password_vault_path?: string; // Alternative: Vault path

      sub_domain: string; // e.g., "grafana.example.com"
      accessible_outside_vpn: boolean; // false = VPN-only access

      // Pre-configured dashboards
      default_dashboards: {
        kubernetes_cluster: boolean; // K8s cluster overview
        node_metrics: boolean; // Node exporter dashboard
        prometheus_stats: boolean; // Prometheus internal metrics
        loki_logs: boolean; // Log exploration dashboard
      };

      // Data sources (auto-configured)
      datasources: {
        prometheus_url?: string; // Auto-detected if not provided
        loki_url?: string; // Auto-detected if not provided
      };
    };

    loki?: {
      enabled: boolean;
      retention_days: number; // Default: 7 days
      storage_size: string; // e.g., "30Gi"

      // Log ingestion
      promtail: boolean; // Default: true (log shipper)

      // Structured metadata
      enable_structured_metadata: boolean; // Parse JSON logs
    };

    alertmanager?: {
      enabled: boolean;

      // Email notifications
      smtp_host?: string; // e.g., "smtp.gmail.com"
      smtp_port?: number; // e.g., 587
      smtp_username_env_var?: string; // ⚠️ SÉCURITÉ
      smtp_password_env_var?: string; // ⚠️ SÉCURITÉ
      smtp_from?: string; // Sender email
      alert_email: string; // Recipient email for alerts

      // Webhook notifications
      webhook_url?: string; // e.g., Slack/Discord webhook

      // Alert grouping
      group_wait: string; // e.g., "30s"
      group_interval: string; // e.g., "5m"
      repeat_interval: string; // e.g., "4h"
    };

    // Metrics retention policy
    metrics_retention: {
      raw_metrics_days: number; // High-resolution metrics
      aggregated_metrics_days: number; // Downsampled metrics
    };
  };

  // ─────────────────────────────────────────────────────────────────────────
  // AUDIT STACK (Falco + Auditd)
  // ─────────────────────────────────────────────────────────────────────────
  audit?: {
    enabled: boolean;

    falco?: {
      enabled: boolean;

      // Falco: Runtime security for containers and hosts
      rule_set: "default" | "strict" | "custom"; // Security rule strictness
      custom_rules_path?: string; // Path to custom Falco rules file

      // Alert priority threshold
      alert_priority: "emergency" | "alert" | "critical" | "error" | "warning" | "notice" | "info" | "debug";

      // Output destinations
      outputs: {
        syslog?: boolean; // Send to syslog
        file?: boolean; // Write to file
        stdout?: boolean; // Print to stdout
        http?: {
          enabled: boolean;
          url: string; // Webhook URL for alerts (e.g., Slack, PagerDuty)
          insecure_skip_verify?: boolean;
        };
        grpc?: {
          enabled: boolean;
          bind_address: string; // e.g., "unix:///var/run/falco/falco.sock"
        };
      };

      // Monitored events
      monitor: {
        privilege_escalation: boolean; // Detect sudo/su usage
        sensitive_file_access: boolean; // /etc/shadow, /etc/passwd, etc.
        unexpected_network_connections: boolean; // Suspicious outbound connections
        container_escapes: boolean; // Container breakout attempts
        kernel_module_load: boolean; // Kernel module injection
        binary_execution: boolean; // Execution of binaries in /tmp
      };
    };

    auditd?: {
      enabled: boolean;

      // Linux Audit daemon for system-level auditing
      log_format: "raw" | "enriched"; // Raw = original format, Enriched = parsed JSON
      max_log_file_size: number; // MB (e.g., 100)
      max_log_files: number; // Rotation count (e.g., 10)
      log_directory: string; // Default: "/var/log/audit"

      // Pre-configured audit rules
      audit_syscalls: boolean; // Monitor system calls (execve, open, connect, etc.)
      audit_file_changes: boolean; // Monitor /etc, /bin, /sbin, /usr/bin, /usr/sbin
      audit_user_actions: boolean; // Monitor user logins/logouts, su/sudo
      audit_network: boolean; // Monitor network connections
      audit_privileged_commands: boolean; // Monitor setuid/setgid binaries

      // Custom audit rules
      custom_rules_path?: string; // Path to custom audit.rules file
    };

    // Centralized audit log storage
    audit_log_forwarding: {
      enabled: boolean;
      destination: "loki" | "elasticsearch" | "s3" | "local";
      destination_url?: string; // If using external destination
    };
  };

  // ─────────────────────────────────────────────────────────────────────────
  // COMPLIANCE STACK (Wazuh + OpenSCAP)
  // ─────────────────────────────────────────────────────────────────────────
  compliance?: {
    enabled: boolean;

    wazuh?: {
      enabled: boolean;

      // Wazuh: Open-source SIEM and XDR platform
      manager_vm_id?: number; // Optional: dedicated VM for Wazuh manager
      manager_host?: string; // If manager is external

      // Agent configuration
      agent_groups: string[]; // Groups for organizing agents (e.g., ["kubernetes", "production"])

      // Compliance frameworks
      rules: {
        pci_dss: boolean; // PCI DSS compliance (credit card data)
        gdpr: boolean; // GDPR compliance (EU data protection)
        hipaa: boolean; // HIPAA compliance (healthcare data)
        nist_800_53: boolean; // NIST 800-53 (US government)
        cis: boolean; // CIS benchmarks (industry best practices)
        tsc: boolean; // TSC (SOC 2 compliance)
        iso_27001: boolean; // ISO 27001 (information security)
      };

      // Security modules
      vulnerability_detection: boolean; // CVE scanning for packages
      file_integrity_monitoring: boolean; // FIM: detect file changes
      security_configuration_assessment: boolean; // SCA: configuration checks
      docker_monitoring: boolean; // Monitor Docker daemon and containers
      cloud_security_monitoring: boolean; // Monitor cloud APIs (AWS, Azure, GCP)

      // Alert configuration
      alert_level: number; // 0-15, alerts >= this level are logged (default: 3)
      email_alerts: boolean; // Send email notifications
      email_to?: string; // Alert recipient

      // Integration
      integrate_with_loki: boolean; // Forward logs to Loki
      integrate_with_prometheus: boolean; // Export metrics to Prometheus
    };

    openscap?: {
      enabled: boolean;

      // OpenSCAP: Security compliance scanning
      scan_schedule: string; // Cron expression, e.g., "0 2 * * 0" (weekly on Sunday at 2 AM)

      // SCAP profiles to scan against
      profiles: string[]; // e.g., ["pci-dss", "cis", "stig", "ospp"]
      // Available profiles:
      // - xccdf_org.ssgproject.content_profile_pci-dss (PCI DSS)
      // - xccdf_org.ssgproject.content_profile_cis (CIS Benchmarks)
      // - xccdf_org.ssgproject.content_profile_stig (DISA STIG)
      // - xccdf_org.ssgproject.content_profile_ospp (OS Protection Profile)

      // Remediation
      remediation: boolean; // Auto-remediate when possible (⚠️ test in non-prod first)
      remediation_dry_run: boolean; // Generate remediation scripts without applying

      // Reporting
      report_storage: string; // Path to store SCAP reports (e.g., "/var/lib/scap/reports")
      report_format: "html" | "xml" | "json" | "all"; // Report output format

      // Thresholds
      fail_on_severity: "low" | "medium" | "high" | "critical"; // Fail scans if issues above this severity
    };

    // Compliance reporting
    compliance_reports: {
      enabled: boolean;
      schedule: string; // Cron expression for report generation
      recipients: string[]; // Email addresses for compliance reports
      format: "pdf" | "html" | "csv";
    };
  };

  // ─────────────────────────────────────────────────────────────────────────
  // CENTRALIZED LOGGING
  // ─────────────────────────────────────────────────────────────────────────
  log_aggregation?: {
    enabled: boolean;

    // Retention policy
    retention_policy: {
      hot_storage_days: number; // Fast access (SSD) - e.g., 7 days
      warm_storage_days: number; // Slower access (HDD) - e.g., 30 days
      cold_storage_days: number; // Archive (S3/object storage) - e.g., 365 days
    };

    // Log parsing
    structured_logging: boolean; // Parse JSON logs
    log_enrichment: boolean; // Add metadata (hostname, k8s namespace, etc.)

    // Log sources
    sources: {
      kubernetes: boolean; // K8s logs (pods, events)
      system: boolean; // System logs (syslog, journald)
      audit: boolean; // Audit logs (auditd, falco)
      application: boolean; // Application logs (custom apps)
    };
  };

  // ─────────────────────────────────────────────────────────────────────────
  // DASHBOARDS & VISUALIZATION
  // ─────────────────────────────────────────────────────────────────────────
  dashboards?: {
    security_overview: boolean; // Main security dashboard (threats, vulnerabilities)
    compliance_status: boolean; // Compliance posture (PCI-DSS, GDPR, etc.)
    audit_timeline: boolean; // Audit events timeline
    threat_detection: boolean; // Real-time threat detection
    performance_metrics: boolean; // Infrastructure performance
    cost_tracking: boolean; // Resource cost tracking
  };

  // ─────────────────────────────────────────────────────────────────────────
  // ALERTING RULES (pre-configured)
  // ─────────────────────────────────────────────────────────────────────────
  alerting?: {
    enabled: boolean;

    // Infrastructure alerts
    infrastructure_alerts: {
      cpu_high: boolean; // CPU > 80% for 5 minutes
      memory_high: boolean; // Memory > 85% for 5 minutes
      disk_full: boolean; // Disk > 90%
      node_down: boolean; // Node unreachable
    };

    // Security alerts
    security_alerts: {
      failed_logins: boolean; // Multiple failed login attempts
      privilege_escalation: boolean; // Suspicious sudo/su usage
      file_integrity_violation: boolean; // Critical file modified
      malware_detected: boolean; // Malware signature detected
      compliance_violation: boolean; // Compliance rule violated
    };

    // Application alerts
    application_alerts: {
      pod_crashloop: boolean; // Pod restarting frequently
      high_error_rate: boolean; // HTTP 5xx errors > threshold
      slow_response_time: boolean; // Response time > 1s
      cert_expiry: boolean; // TLS cert expiring in < 30 days
    };
  };
}
