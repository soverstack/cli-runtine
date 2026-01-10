import fs from "fs";
import path from "path";
import yaml from "js-yaml";
import crypto from "crypto";

/**
 * Infrastructure state (WITHOUT SECRETS!)
 */
export interface InfrastructureState {
  version: string;
  updated_at: string;
  infrastructure_tier: "local" | "production" | "enterprise";
  environment?: string;

  // Checksums for change detection
  checksums: {
    platform: string;
    datacenter: string;
    firewall?: string;
    bastion?: string;
    compute?: string;
    cluster?: string;
    features?: string;
  };

  // Resource states (WITHOUT credentials/passwords/keys)
  resources: ResourceState[];

  // Metadata
  metadata: {
    applied_by?: string;
    applied_at: string;
    plan_checksum: string;
    terraform_version?: string;
    ansible_version?: string;
  };
}

export interface ResourceState {
  id: string; // Resource ID from plan
  type: string; // Resource type
  layer: string;
  status: "created" | "updated" | "failed" | "pending";
  checksum: string; // Configuration checksum

  // Resource metadata (NO SECRETS!)
  metadata: {
    created_at?: string;
    updated_at?: string;
    last_error?: string;
  };

  // Sanitized attributes (NO passwords, keys, tokens)
  attributes: Record<string, any>;
}

/**
 * State backend configuration
 */
export interface StateBackend {
  type: "local" | "aws" | "gcr" | "azure";
  path: string;

  // S3 configuration
  s3?: {
    bucket: string;
    key: string;
    region: string;
    endpoint?: string;
    access_key_env_var?: string;
    secret_key_env_var?: string;
  };

  // Azure configuration
  azure?: {
    storage_account: string;
    container: string;
    blob_name: string;
    access_key_env_var?: string;
  };
}

/**
 * State Manager - handles state persistence without secrets
 */
export class StateManager {
  private backend: StateBackend;
  private localStatePath: string;

  constructor(backend: StateBackend, platformDir: string) {
    this.backend = backend;
    this.localStatePath = path.join(platformDir, ".soverstack", "state.yaml");
  }

  /**
   * Loads current state
   */
  async loadState(): Promise<InfrastructureState | null> {
    try {
      if (this.backend.type === "local") {
        return this.loadLocalState();
      } else if (this.backend.type === "aws") {
        return await this.loadS3State();
      } else if (this.backend.type === "azure") {
        return await this.loadAzureState();
      }
    } catch (error) {
      console.error(`Failed to load state: ${(error as Error).message}`);
      return null;
    }

    return null;
  }

  /**
   * Saves state (WITHOUT SECRETS!)
   */
  async saveState(state: InfrastructureState): Promise<void> {
    // SECURITY: Sanitize state before saving
    const sanitizedState = this.sanitizeState(state);

    // Always save locally first
    this.saveLocalState(sanitizedState);

    // Save to remote backend
    if (this.backend.type === "aws") {
      await this.saveS3State(sanitizedState);
    } else if (this.backend.type === "azure") {
      await this.saveAzureState(sanitizedState);
    }
  }

  /**
   * SECURITY: Sanitizes state to remove all secrets
   */
  private sanitizeState(state: InfrastructureState): InfrastructureState {
    const sanitized = JSON.parse(JSON.stringify(state));

    // Remove secrets from resources
    sanitized.resources = sanitized.resources.map((resource: ResourceState) => {
      const sanitizedResource = { ...resource };

      // Remove all sensitive attributes
      if (sanitizedResource.attributes) {
        sanitizedResource.attributes = this.removeSensitiveData(
          sanitizedResource.attributes
        );
      }

      return sanitizedResource;
    });

    return sanitized;
  }

  /**
   * SECURITY: Removes sensitive data from object
   */
  private removeSensitiveData(obj: any): any {
    if (!obj || typeof obj !== "object") {
      return obj;
    }

    const sanitized: any = Array.isArray(obj) ? [] : {};

    for (const [key, value] of Object.entries(obj)) {
      // Skip sensitive fields
      if (this.isSensitiveField(key)) {
        continue; // Don't include in state
      }

      // Recursively sanitize nested objects
      if (value && typeof value === "object") {
        sanitized[key] = this.removeSensitiveData(value);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * Checks if a field name indicates sensitive data
   */
  private isSensitiveField(fieldName: string): boolean {
    const sensitivePatterns = [
      "password",
      "passwd",
      "secret",
      "token",
      "api_key",
      "apikey",
      "access_key",
      "secret_key",
      "private_key",
      "public_key",
      "ssh_key",
      "certificate",
      "cert",
      "credentials",
      "auth",
      "passphrase",
      "pass_key",
      "_env_var",
      "_vault_path",
    ];

    const lowerField = fieldName.toLowerCase();
    return sensitivePatterns.some((pattern) => lowerField.includes(pattern));
  }

  /**
   * Loads state from local filesystem
   */
  private loadLocalState(): InfrastructureState | null {
    if (!fs.existsSync(this.localStatePath)) {
      return null;
    }

    try {
      const content = fs.readFileSync(this.localStatePath, "utf8");
      return yaml.load(content) as InfrastructureState;
    } catch (error) {
      throw new Error(`Failed to load local state: ${(error as Error).message}`);
    }
  }

  /**
   * Saves state to local filesystem
   */
  private saveLocalState(state: InfrastructureState): void {
    const stateDir = path.dirname(this.localStatePath);

    if (!fs.existsSync(stateDir)) {
      fs.mkdirSync(stateDir, { recursive: true });
    }

    const yamlContent = yaml.dump(state, {
      indent: 2,
      lineWidth: 120,
      noRefs: true,
    });

    fs.writeFileSync(this.localStatePath, yamlContent, "utf8");
  }

  /**
   * Loads state from S3
   */
  private async loadS3State(): Promise<InfrastructureState | null> {
    if (!this.backend.s3) {
      throw new Error("S3 configuration missing");
    }

    // SECURITY: Load credentials from env vars
    const accessKey = process.env[this.backend.s3.access_key_env_var || "AWS_ACCESS_KEY_ID"];
    const secretKey = process.env[this.backend.s3.secret_key_env_var || "AWS_SECRET_ACCESS_KEY"];

    if (!accessKey || !secretKey) {
      throw new Error("S3 credentials not found in environment variables");
    }

    try {
      // Use AWS SDK to fetch state
      const { S3Client, GetObjectCommand } = await import("@aws-sdk/client-s3");

      const client = new S3Client({
        region: this.backend.s3.region,
        endpoint: this.backend.s3.endpoint,
        credentials: {
          accessKeyId: accessKey,
          secretAccessKey: secretKey,
        },
      });

      const command = new GetObjectCommand({
        Bucket: this.backend.s3.bucket,
        Key: this.backend.s3.key,
      });

      const response = await client.send(command);
      const body = await response.Body?.transformToString();

      if (!body) {
        return null;
      }

      return yaml.load(body) as InfrastructureState;
    } catch (error: any) {
      if (error.name === "NoSuchKey") {
        return null; // State doesn't exist yet
      }
      throw error;
    }
  }

  /**
   * Saves state to S3
   */
  private async saveS3State(state: InfrastructureState): Promise<void> {
    if (!this.backend.s3) {
      throw new Error("S3 configuration missing");
    }

    // SECURITY: Load credentials from env vars
    const accessKey = process.env[this.backend.s3.access_key_env_var || "AWS_ACCESS_KEY_ID"];
    const secretKey = process.env[this.backend.s3.secret_key_env_var || "AWS_SECRET_ACCESS_KEY"];

    if (!accessKey || !secretKey) {
      throw new Error("S3 credentials not found in environment variables");
    }

    const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");

    const client = new S3Client({
      region: this.backend.s3.region,
      endpoint: this.backend.s3.endpoint,
      credentials: {
        accessKeyId: accessKey,
        secretAccessKey: secretKey,
      },
    });

    const yamlContent = yaml.dump(state, {
      indent: 2,
      lineWidth: 120,
      noRefs: true,
    });

    const command = new PutObjectCommand({
      Bucket: this.backend.s3.bucket,
      Key: this.backend.s3.key,
      Body: yamlContent,
      ContentType: "application/x-yaml",
    });

    await client.send(command);
  }

  /**
   * Loads state from Azure Blob Storage
   */
  private async loadAzureState(): Promise<InfrastructureState | null> {
    if (!this.backend.azure) {
      throw new Error("Azure configuration missing");
    }

    // SECURITY: Load access key from env var
    const accessKey = process.env[this.backend.azure.access_key_env_var || "AZURE_STORAGE_KEY"];

    if (!accessKey) {
      throw new Error("Azure storage key not found in environment variables");
    }

    try {
      const { BlobServiceClient, StorageSharedKeyCredential } = await import("@azure/storage-blob");

      const credential = new StorageSharedKeyCredential(
        this.backend.azure.storage_account,
        accessKey
      );

      const blobServiceClient = new BlobServiceClient(
        `https://${this.backend.azure.storage_account}.blob.core.windows.net`,
        credential
      );

      const containerClient = blobServiceClient.getContainerClient(this.backend.azure.container);
      const blobClient = containerClient.getBlobClient(this.backend.azure.blob_name);

      const downloadResponse = await blobClient.download();
      const body = downloadResponse.readableStreamBody;

      if (!body) {
        return null;
      }

      const content = await this.streamToString(body);
      return yaml.load(content) as InfrastructureState;
    } catch (error: any) {
      if (error.statusCode === 404) {
        return null; // State doesn't exist yet
      }
      throw error;
    }
  }

  /**
   * Saves state to Azure Blob Storage
   */
  private async saveAzureState(state: InfrastructureState): Promise<void> {
    if (!this.backend.azure) {
      throw new Error("Azure configuration missing");
    }

    // SECURITY: Load access key from env var
    const accessKey = process.env[this.backend.azure.access_key_env_var || "AZURE_STORAGE_KEY"];

    if (!accessKey) {
      throw new Error("Azure storage key not found in environment variables");
    }

    const { BlobServiceClient, StorageSharedKeyCredential } = await import("@azure/storage-blob");

    const credential = new StorageSharedKeyCredential(
      this.backend.azure.storage_account,
      accessKey
    );

    const blobServiceClient = new BlobServiceClient(
      `https://${this.backend.azure.storage_account}.blob.core.windows.net`,
      credential
    );

    const containerClient = blobServiceClient.getContainerClient(this.backend.azure.container);
    const blobClient = containerClient.getBlockBlobClient(this.backend.azure.blob_name);

    const yamlContent = yaml.dump(state, {
      indent: 2,
      lineWidth: 120,
      noRefs: true,
    });

    await blobClient.upload(yamlContent, Buffer.byteLength(yamlContent), {
      blobHTTPHeaders: { blobContentType: "application/x-yaml" },
    });
  }

  /**
   * Helper to convert stream to string
   */
  private async streamToString(stream: NodeJS.ReadableStream): Promise<string> {
    const chunks: Buffer[] = [];

    return new Promise((resolve, reject) => {
      stream.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
      stream.on("error", (err) => reject(err));
      stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    });
  }

  /**
   * Creates initial state from plan
   */
  createInitialState(
    plan: any,
    infrastructure_tier: string,
    environment?: string
  ): InfrastructureState {
    return {
      version: "1.0.0",
      updated_at: new Date().toISOString(),
      infrastructure_tier: infrastructure_tier as any,
      environment,

      checksums: {
        platform: this.generateChecksum(plan),
        datacenter: "",
        firewall: "",
        bastion: "",
        compute: "",
        cluster: "",
        features: "",
      },

      resources: [],

      metadata: {
        applied_at: new Date().toISOString(),
        plan_checksum: this.generateChecksum(plan),
      },
    };
  }

  /**
   * Generates checksum for object
   */
  private generateChecksum(obj: any): string {
    const jsonString = JSON.stringify(obj, Object.keys(obj).sort());
    return crypto.createHash("sha256").update(jsonString).digest("hex");
  }
}
