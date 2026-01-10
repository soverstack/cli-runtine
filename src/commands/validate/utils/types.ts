// ═══════════════════════════════════════════════════════════════════════════
// VALIDATION - TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  layer: string; // datacenter, compute, cluster, feature, firewall, bastion
  field: string; // Chemin du champ (ex: "servers[0].root_password")
  message: string;
  severity: "critical" | "error";
  suggestion?: string;
}

export interface ValidationWarning {
  layer: string;
  field: string;
  message: string;
  suggestion?: string;
}

export interface ValidationContext {
  // Cross-layer validation context
  vm_ids_used: Map<number, string>; // vm_id -> vm_name
  server_names: Set<string>;
  host_names: Set<string>;
  cluster_names: Set<string>;
}

// Helper to create validation results
export function createValidationResult(): ValidationResult {
  return {
    valid: true,
    errors: [],
    warnings: [],
  };
}

export function addError(
  result: ValidationResult,
  layer: string,
  field: string,
  message: string,
  severity: "critical" | "error" = "error",
  suggestion?: string
): void {
  result.valid = false;
  result.errors.push({ layer, field, message, severity, suggestion });
}

export function addWarning(
  result: ValidationResult,
  layer: string,
  field: string,
  message: string,
  suggestion?: string
): void {
  result.warnings.push({ layer, field, message, suggestion });
}
