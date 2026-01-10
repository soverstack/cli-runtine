import { Feature, InfrastructureTierType } from "../../../types";
import { ValidationResult, ValidationContext, addError, addWarning } from "../utils/types";
import { validateAccessibleOutsideVpn } from "../rules/security";

export function validateSSH(
  feature: Feature,
  context: ValidationContext,
  result: ValidationResult,
  infrastructureTier: InfrastructureTierType
): void {}
