import fs from "fs";
import path from "path";
import yaml from "js-yaml";
import { ValidationResult, addError } from "./types";

/**
 * Loads and parses a YAML file with error handling
 */
export function loadYamlFile<T>(filePath: string, result: ValidationResult, layer: string): T | null {
  try {
    const absolutePath = path.resolve(filePath);

    if (!fs.existsSync(absolutePath)) {
      addError(
        result,
        layer,
        "file",
        `File not found: ${filePath}`,
        "critical",
        "Check that the file path is correct"
      );
      return null;
    }

    const fileContent = fs.readFileSync(absolutePath, "utf8");
    return yaml.load(fileContent) as T;
  } catch (error) {
    addError(
      result,
      layer,
      "file",
      `Failed to parse YAML: ${(error as Error).message}`,
      "critical",
      "Check YAML syntax (indentation, colons, quotes)"
    );
    return null;
  }
}

/**
 * Loads and parses a YAML file (simple version without ValidationResult)
 * Throws error on failure - used for normalizer
 */
export function loadYaml<T>(filePath: string): T {
  const absolutePath = path.resolve(filePath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  try {
    const fileContent = fs.readFileSync(absolutePath, "utf8");
    return yaml.load(fileContent) as T;
  } catch (error) {
    throw new Error(`Failed to parse YAML file ${filePath}: ${(error as Error).message}`);
  }
}

/**
 * Validates that a file path exists and is accessible
 */
export function validateFilePath(
  filePath: string,
  result: ValidationResult,
  layer: string,
  fieldName: string
): boolean {
  if (!filePath) {
    addError(result, layer, fieldName, `File path is required`, "error");
    return false;
  }

  const absolutePath = path.resolve(filePath);

  if (!fs.existsSync(absolutePath)) {
    addError(
      result,
      layer,
      fieldName,
      `File not found: ${filePath}`,
      "error",
      "Create the file or update the path"
    );
    return false;
  }

  return true;
}
