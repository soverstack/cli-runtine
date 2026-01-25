import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { Platform, Datacenter, ComputeConfig, Feature, K8sCluster } from '../types';

/**
 * Load and parse a YAML file
 */
export function loadYamlFile<T>(filePath: string): T {
  try {
    const absolutePath = path.resolve(filePath);
    const fileContent = fs.readFileSync(absolutePath, 'utf8');
    return yaml.load(fileContent) as T;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to load YAML file ${filePath}: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Load platform.yaml
 */
export function loadPlatform(filePath: string = './platform.yaml'): Platform {
  return loadYamlFile<Platform>(filePath);
}

/**
 * Load a layer file based on platform configuration
 */
export function loadLayer<T>(
  platform: Platform,
  layerName: keyof NonNullable<Platform['layers']>
): T | null {
  if (!platform.layers) {
    return null;
  }

  const layerPath = platform.layers[layerName];

  if (!layerPath) {
    return null;
  }

  return loadYamlFile<T>(layerPath);
}

/**
 * Check if a file exists
 */
export function fileExists(filePath: string): boolean {
  try {
    return fs.existsSync(path.resolve(filePath));
  } catch {
    return false;
  }
}
