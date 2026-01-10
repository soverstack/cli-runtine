import fs from "fs";
import path from "path";
import { InitOptions } from "./index";

export function createObservabilityFile(options: InitOptions, environment?: string): void {
  const projectPath = path.resolve(process.cwd(), options.projectName);
  const observabilityDir = path.join(projectPath, "layers", "observability");

  // Create directory if it doesn't exist
  if (!fs.existsSync(observabilityDir)) {
    fs.mkdirSync(observabilityDir, { recursive: true });
  }

  const filename = environment ? `observability-${environment}.yaml` : "observability.yaml";
  const filePath = path.join(observabilityDir, filename);

  const content = generateObservabilityContent(options, environment);

  fs.writeFileSync(filePath, content, "utf-8");
}

function generateObservabilityContent(options: InitOptions, environment?: string): string {
  const tier = options.infrastructureTier || "production";
  const envSuffix = environment ? `_${environment.toUpperCase()}` : "";

  // Adjust configuration based on infrastructure tier
  const isLocal = tier === "local";
  const isProduction = tier === "production";
  const isEnterprise = tier === "enterprise";

  return `# ═══════════════════════════════════════════════════════════════════════════
# OBSERVABILITY LAYER - Monitoring, Audit & Compliance
# ═══════════════════════════════════════════════════════════════════════════
#
# This layer provides comprehensive observability with:
# - Monitoring: Prometheus + Grafana + Loki (metrics, logs, dashboards)
# - Audit: Falco + Auditd (security events, runtime protection)
# - Compliance: Wazuh + OpenSCAP (PCI-DSS, GDPR, CIS, vulnerability detection)
#
# Best practices:
# - Start with monitoring enabled in all environments
# - Enable audit in production for security
# - Enable compliance for regulated industries
#
# ═══════════════════════════════════════════════════════════════════════════

enabled: ${!isLocal} # Disable in local for resource efficiency

# ─────────────────────────────────────────────────────────────────────────
# MONITORING STACK (Prometheus + Grafana + Loki)
# ─────────────────────────────────────────────────────────────────────────
monitoring:
  enabled: true

  prometheus:
    enabled: true
    retention_days: ${isLocal ? 7 : isProduction ? 15 : 30}
    storage_size: "${isLocal ? "10Gi" : isProduction ? "50Gi" : "100Gi"}"
    scrape_interval: "${isLocal ? "60s" : "30s"}"
    evaluation_interval: "30s"
    ${isEnterprise ? `vm_id: 4001 # Dedicated VM for Prometheus in enterprise` : "# vm_id: 4001 # Optional: dedicated VM"}

    # System metrics
    node_exporter: true

    # Service discovery
    kubernetes_sd: ${!isLocal}
    # static_targets:
    #   - "node1:9100" # Node exporter
    #   - "node2:9100"

  grafana:
    enabled: true

    # ⚠️ SÉCURITÉ: Store password in .env file
    admin_password_env_var: "GRAFANA_ADMIN_PASSWORD${envSuffix}"
    # admin_password_vault_path: "secret/observability/grafana/admin_password"

    sub_domain: "grafana${environment ? `-${environment}` : ""}.example.com"
    accessible_outside_vpn: ${isLocal || !isProduction} # Only local/dev accessible outside VPN

    # Pre-configured dashboards
    default_dashboards:
      kubernetes_cluster: ${!isLocal}
      node_metrics: true
      prometheus_stats: true
      loki_logs: true

    datasources:
      # Auto-detected if not provided
      # prometheus_url: "http://prometheus:9090"
      # loki_url: "http://loki:3100"

  loki:
    enabled: ${!isLocal}
    retention_days: ${isLocal ? 3 : isProduction ? 7 : 14}
    storage_size: "${isLocal ? "5Gi" : isProduction ? "30Gi" : "50Gi"}"

    # Log collection
    promtail: true # Log shipper for all nodes

    # Structured logging
    enable_structured_metadata: true # Parse JSON logs

  alertmanager:
    enabled: ${isProduction || isEnterprise}

    # Email notifications
    smtp_host: "smtp.example.com"
    smtp_port: 587
    smtp_username_env_var: "SMTP_USERNAME${envSuffix}"
    smtp_password_env_var: "SMTP_PASSWORD${envSuffix}"
    smtp_from: "alerts@example.com"
    alert_email: "admin@example.com"

    # Webhook (e.g., Slack, Discord)
    # webhook_url: "https://hooks.slack.com/services/YOUR/WEBHOOK/URL"

    # Alert grouping
    group_wait: "30s"
    group_interval: "5m"
    repeat_interval: "4h"

  # Metrics retention
  metrics_retention:
    raw_metrics_days: ${isLocal ? 7 : 15}
    aggregated_metrics_days: ${isLocal ? 30 : 90}

# ─────────────────────────────────────────────────────────────────────────
# AUDIT STACK (Falco + Auditd)
# ─────────────────────────────────────────────────────────────────────────
audit:
  enabled: ${isProduction || isEnterprise} # Critical for production security

  falco:
    enabled: ${isProduction || isEnterprise}

    # Security rules
    rule_set: "${isLocal ? "default" : isProduction ? "strict" : "strict"}"
    # custom_rules_path: "/etc/falco/custom_rules.yaml"

    # Alert threshold
    alert_priority: "${isLocal ? "warning" : isProduction ? "error" : "critical"}"

    # Output destinations
    outputs:
      syslog: true
      file: true
      stdout: ${isLocal}
      http:
        enabled: ${isProduction || isEnterprise}
        url: "https://your-webhook-url.com/falco" # Slack, PagerDuty, etc.
        # insecure_skip_verify: false

    # Monitored events
    monitor:
      privilege_escalation: true # sudo/su detection
      sensitive_file_access: true # /etc/shadow, /etc/passwd
      unexpected_network_connections: ${!isLocal}
      container_escapes: ${!isLocal}
      kernel_module_load: ${!isLocal}
      binary_execution: true # Execution in /tmp

  auditd:
    enabled: ${isProduction || isEnterprise}

    # Configuration
    log_format: "enriched" # enriched = JSON format
    max_log_file_size: 100 # MB
    max_log_files: 10 # Rotation count
    log_directory: "/var/log/audit"

    # Audit rules (pre-configured)
    audit_syscalls: ${!isLocal} # Monitor system calls
    audit_file_changes: true # Monitor /etc, /bin, etc.
    audit_user_actions: true # Logins, sudo, su
    audit_network: ${!isLocal}
    audit_privileged_commands: true # setuid/setgid binaries

  # Centralized audit log storage
  audit_log_forwarding:
    enabled: ${!isLocal}
    destination: "loki" # loki | elasticsearch | s3 | local
    # destination_url: "http://loki:3100"

# ─────────────────────────────────────────────────────────────────────────
# COMPLIANCE STACK (Wazuh + OpenSCAP)
# ─────────────────────────────────────────────────────────────────────────
compliance:
  enabled: ${isEnterprise} # Enterprise-grade compliance

  wazuh:
    enabled: ${isEnterprise}

    # Wazuh manager
    ${isEnterprise ? `manager_vm_id: 4002 # Dedicated VM for Wazuh manager` : "# manager_vm_id: 4002"}
    # manager_host: "wazuh-manager.example.com" # If external

    # Agent groups
    agent_groups:
      - "kubernetes"
      - "${environment || "production"}"

    # Compliance frameworks
    rules:
      pci_dss: ${isEnterprise} # Credit card compliance
      gdpr: ${isProduction || isEnterprise} # EU data protection
      hipaa: false # Healthcare (enable if needed)
      nist_800_53: ${isEnterprise} # US government
      cis: true # CIS benchmarks
      tsc: ${isEnterprise} # SOC 2
      iso_27001: ${isEnterprise} # ISO 27001

    # Security modules
    vulnerability_detection: true # CVE scanning
    file_integrity_monitoring: true # FIM
    security_configuration_assessment: true # SCA
    docker_monitoring: ${!isLocal}
    cloud_security_monitoring: ${isEnterprise}

    # Alerts
    alert_level: ${isLocal ? 7 : isProduction ? 5 : 3} # 0-15 (lower = more alerts)
    email_alerts: ${isProduction || isEnterprise}
    email_to: "security@example.com"

    # Integration
    integrate_with_loki: true
    integrate_with_prometheus: true

  openscap:
    enabled: ${isEnterprise}

    # Scan schedule
    scan_schedule: "0 2 * * 0" # Weekly: Sunday at 2 AM

    # SCAP profiles
    profiles:
      - "pci-dss"
      - "cis"
      ${isEnterprise ? `- "stig"` : "# - \"stig\""}

    # Remediation
    remediation: false # ⚠️ Test in non-prod first!
    remediation_dry_run: true # Generate scripts without applying

    # Reporting
    report_storage: "/var/lib/scap/reports"
    report_format: "all" # html | xml | json | all

    # Thresholds
    fail_on_severity: "${isLocal ? "critical" : "high"}"

  # Compliance reports
  compliance_reports:
    enabled: ${isEnterprise}
    schedule: "0 9 1 * *" # Monthly: 1st day at 9 AM
    recipients:
      - "compliance@example.com"
      - "security@example.com"
    format: "pdf"

# ─────────────────────────────────────────────────────────────────────────
# CENTRALIZED LOGGING
# ─────────────────────────────────────────────────────────────────────────
log_aggregation:
  enabled: ${!isLocal}

  # Retention policy
  retention_policy:
    hot_storage_days: ${isLocal ? 3 : 7} # SSD
    warm_storage_days: ${isLocal ? 7 : 30} # HDD
    cold_storage_days: ${isLocal ? 30 : isProduction ? 365 : 730} # Archive

  # Log parsing
  structured_logging: true # JSON parsing
  log_enrichment: true # Add metadata

  # Log sources
  sources:
    kubernetes: ${!isLocal}
    system: true
    audit: ${isProduction || isEnterprise}
    application: true

# ─────────────────────────────────────────────────────────────────────────
# DASHBOARDS & VISUALIZATION
# ─────────────────────────────────────────────────────────────────────────
dashboards:
  security_overview: ${isProduction || isEnterprise}
  compliance_status: ${isEnterprise}
  audit_timeline: ${isProduction || isEnterprise}
  threat_detection: ${isProduction || isEnterprise}
  performance_metrics: true
  cost_tracking: ${isEnterprise}

# ─────────────────────────────────────────────────────────────────────────
# ALERTING RULES (pre-configured)
# ─────────────────────────────────────────────────────────────────────────
alerting:
  enabled: ${!isLocal}

  # Infrastructure alerts
  infrastructure_alerts:
    cpu_high: true # CPU > 80% for 5 min
    memory_high: true # Memory > 85% for 5 min
    disk_full: true # Disk > 90%
    node_down: true

  # Security alerts
  security_alerts:
    failed_logins: ${isProduction || isEnterprise}
    privilege_escalation: ${isProduction || isEnterprise}
    file_integrity_violation: ${isProduction || isEnterprise}
    malware_detected: ${isProduction || isEnterprise}
    compliance_violation: ${isEnterprise}

  # Application alerts
  application_alerts:
    pod_crashloop: ${!isLocal}
    high_error_rate: ${!isLocal}
    slow_response_time: ${!isLocal}
    cert_expiry: ${isProduction || isEnterprise}
`;
}
