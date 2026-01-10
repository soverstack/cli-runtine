import fs from "fs";
import path from "path";
import { ProjectInitializer } from "../../src/commands/init/logic";
import { InitOptions } from "../../src/commands/init/utils";

describe("Init Command Integration Tests", () => {
  const testProjectsDir = path.join(__dirname, "test-projects");

  beforeAll(() => {
    // Create test projects directory
    if (!fs.existsSync(testProjectsDir)) {
      fs.mkdirSync(testProjectsDir, { recursive: true });
    }
  });

  afterEach(() => {
    // Clean up test projects after each test
    if (fs.existsSync(testProjectsDir)) {
      fs.readdirSync(testProjectsDir).forEach((file) => {
        const projectPath = path.join(testProjectsDir, file);
        if (fs.statSync(projectPath).isDirectory()) {
          fs.rmSync(projectPath, { recursive: true, force: true });
        }
      });
    }
  });

  afterAll(() => {
    // Clean up test projects directory
    if (fs.existsSync(testProjectsDir)) {
      fs.rmSync(testProjectsDir, { recursive: true, force: true });
    }
  });

  describe("Simple Mode Initialization", () => {
    it("should create complete simple project structure", async () => {
      const options: InitOptions = {
        projectName: path.join(testProjectsDir, "simple-project"),
        mode: "simple",
        infrastructureTier: "local",
      };

      const initializer = new ProjectInitializer(options);
      await initializer.initialize();

      const projectPath = options.projectName;

      // Verify project directory exists
      expect(fs.existsSync(projectPath)).toBe(true);

      // Verify directory structure
      expect(fs.existsSync(path.join(projectPath, "layers"))).toBe(true);
      expect(fs.existsSync(path.join(projectPath, "ssh"))).toBe(true);
      expect(fs.existsSync(path.join(projectPath, ".soverstack"))).toBe(true);

      // Verify .soverstack subdirectories
      expect(fs.existsSync(path.join(projectPath, ".soverstack/state"))).toBe(true);
      expect(fs.existsSync(path.join(projectPath, ".soverstack/logs"))).toBe(true);
      expect(fs.existsSync(path.join(projectPath, ".soverstack/cache"))).toBe(true);

      // Verify essential files
      expect(fs.existsSync(path.join(projectPath, "platform.yaml"))).toBe(true);
      expect(fs.existsSync(path.join(projectPath, ".gitignore"))).toBe(true);
      expect(fs.existsSync(path.join(projectPath, "README.md"))).toBe(true);
      expect(fs.existsSync(path.join(projectPath, ".env"))).toBe(true);
    });

    it("should create environment-specific files in simple mode", async () => {
      const options: InitOptions = {
        projectName: path.join(testProjectsDir, "simple-multi-env"),
        mode: "simple",
        environments: ["prod", "dev"],
      };

      const initializer = new ProjectInitializer(options);
      await initializer.initialize();

      const projectPath = options.projectName;

      // Verify environment-specific layer files
      expect(fs.existsSync(path.join(projectPath, "layers/infrastructure-prod.yaml"))).toBe(true);
      expect(fs.existsSync(path.join(projectPath, "layers/infrastructure-dev.yaml"))).toBe(true);

      // Verify environment-specific SSH configs
      expect(fs.existsSync(path.join(projectPath, "ssh/ssh-prod.yaml"))).toBe(true);
      expect(fs.existsSync(path.join(projectPath, "ssh/ssh-dev.yaml"))).toBe(true);

      // Verify environment-specific .env files
      expect(fs.existsSync(path.join(projectPath, ".env.prod"))).toBe(true);
      expect(fs.existsSync(path.join(projectPath, ".env.dev"))).toBe(true);
    });
  });

  describe("Advanced Mode Initialization", () => {
    it("should create complete advanced project structure", async () => {
      const options: InitOptions = {
        projectName: path.join(testProjectsDir, "advanced-project"),
        mode: "advanced",
        infrastructureTier: "production",
      };

      const initializer = new ProjectInitializer(options);
      await initializer.initialize();

      const projectPath = options.projectName;

      // Verify advanced layer directories
      const expectedDirs = [
        "layers/datacenters",
        "layers/computes",
        "layers/clusters",
        "layers/features",
        "layers/firewalls",
        "layers/bastions",
      ];

      expectedDirs.forEach((dir) => {
        expect(fs.existsSync(path.join(projectPath, dir))).toBe(true);
      });

      // Verify layer files
      expect(fs.existsSync(path.join(projectPath, "layers/datacenters/datacenter.yaml"))).toBe(true);
      expect(fs.existsSync(path.join(projectPath, "layers/computes/compute.yaml"))).toBe(true);
      expect(fs.existsSync(path.join(projectPath, "layers/clusters/k8s.yaml"))).toBe(true);
      expect(fs.existsSync(path.join(projectPath, "layers/features/features.yaml"))).toBe(true);
      expect(fs.existsSync(path.join(projectPath, "layers/firewalls/firewall.yaml"))).toBe(true);
      expect(fs.existsSync(path.join(projectPath, "layers/bastions/bastion.yaml"))).toBe(true);
    });

    it("should create environment-specific layer files in advanced mode", async () => {
      const options: InitOptions = {
        projectName: path.join(testProjectsDir, "advanced-multi-env"),
        mode: "advanced",
        environments: ["prod", "staging"],
        infrastructureTier: "enterprise",
      };

      const initializer = new ProjectInitializer(options);
      await initializer.initialize();

      const projectPath = options.projectName;

      // Verify environment-specific datacenter files
      expect(fs.existsSync(path.join(projectPath, "layers/datacenters/dc-prod.yaml"))).toBe(true);
      expect(fs.existsSync(path.join(projectPath, "layers/datacenters/dc-staging.yaml"))).toBe(true);

      // Verify environment-specific compute files
      expect(fs.existsSync(path.join(projectPath, "layers/computes/compute-prod.yaml"))).toBe(true);
      expect(fs.existsSync(path.join(projectPath, "layers/computes/compute-staging.yaml"))).toBe(true);

      // Verify environment-specific cluster files
      expect(fs.existsSync(path.join(projectPath, "layers/clusters/k8s-prod.yaml"))).toBe(true);
      expect(fs.existsSync(path.join(projectPath, "layers/clusters/k8s-staging.yaml"))).toBe(true);
    });
  });

  describe("SSH Key Generation", () => {
    it("should generate SSH keys when requested", async () => {
      const options: InitOptions = {
        projectName: path.join(testProjectsDir, "ssh-keys-project"),
        mode: "simple",
        generateSshKeys: true,
      };

      const initializer = new ProjectInitializer(options);
      await initializer.initialize();

      const projectPath = options.projectName;

      // Verify SSH keys generated
      expect(fs.existsSync(path.join(projectPath, "ssh/id_rsa"))).toBe(true);
      expect(fs.existsSync(path.join(projectPath, "ssh/id_rsa.pub"))).toBe(true);

      // Verify SSH keys have content
      const privateKey = fs.readFileSync(path.join(projectPath, "ssh/id_rsa"), "utf-8");
      const publicKey = fs.readFileSync(path.join(projectPath, "ssh/id_rsa.pub"), "utf-8");

      expect(privateKey.length).toBeGreaterThan(0);
      expect(publicKey.length).toBeGreaterThan(0);
      expect(privateKey).toContain("BEGIN");
      expect(privateKey).toContain("PRIVATE KEY");
    });

    it("should not generate SSH keys when not requested", async () => {
      const options: InitOptions = {
        projectName: path.join(testProjectsDir, "no-ssh-project"),
        mode: "simple",
        generateSshKeys: false,
      };

      const initializer = new ProjectInitializer(options);
      await initializer.initialize();

      const projectPath = options.projectName;

      // Verify SSH keys NOT generated
      expect(fs.existsSync(path.join(projectPath, "ssh/id_rsa"))).toBe(false);
      expect(fs.existsSync(path.join(projectPath, "ssh/id_rsa.pub"))).toBe(false);
    });
  });

  describe("File Content Validation", () => {
    it("should generate valid platform.yaml", async () => {
      const options: InitOptions = {
        projectName: path.join(testProjectsDir, "platform-yaml-test"),
        mode: "advanced",
        environments: ["prod"],
        infrastructureTier: "production",
      };

      const initializer = new ProjectInitializer(options);
      await initializer.initialize();

      const projectPath = options.projectName;
      const platformYaml = fs.readFileSync(path.join(projectPath, "platform.yaml"), "utf-8");

      // Verify platform.yaml contains expected structure
      expect(platformYaml).toContain("project:");
      expect(platformYaml).toContain("name:");
      expect(platformYaml).toContain("infrastructure_tier:");
      expect(platformYaml).toContain("datacenter:");
      expect(platformYaml).toContain("compute:");
    });

    it("should generate valid .gitignore", async () => {
      const options: InitOptions = {
        projectName: path.join(testProjectsDir, "gitignore-test"),
        mode: "simple",
      };

      const initializer = new ProjectInitializer(options);
      await initializer.initialize();

      const projectPath = options.projectName;
      const gitignore = fs.readFileSync(path.join(projectPath, ".gitignore"), "utf-8");

      // Verify .gitignore contains sensitive patterns
      expect(gitignore).toContain(".env");
      expect(gitignore).toContain("ssh/id_rsa");
      expect(gitignore).toContain(".soverstack");
    });

    it("should generate valid README.md", async () => {
      const options: InitOptions = {
        projectName: path.join(testProjectsDir, "readme-test"),
        mode: "advanced",
      };

      const initializer = new ProjectInitializer(options);
      await initializer.initialize();

      const projectPath = options.projectName;
      const readme = fs.readFileSync(path.join(projectPath, "README.md"), "utf-8");

      // Verify README contains project name
      expect(readme).toContain("readme-test");
      expect(readme).toContain("Soverstack");
      expect(readme).toContain("##"); // Has sections
    });
  });

  describe("Infrastructure Tiers", () => {
    it("should create project with local tier", async () => {
      const options: InitOptions = {
        projectName: path.join(testProjectsDir, "local-tier"),
        mode: "advanced",
        infrastructureTier: "local",
      };

      const initializer = new ProjectInitializer(options);
      await initializer.initialize();

      const projectPath = options.projectName;
      const platformYaml = fs.readFileSync(path.join(projectPath, "platform.yaml"), "utf-8");

      expect(platformYaml).toContain("infrastructure_tier: local");
    });

    it("should create project with production tier", async () => {
      const options: InitOptions = {
        projectName: path.join(testProjectsDir, "prod-tier"),
        mode: "advanced",
        infrastructureTier: "production",
      };

      const initializer = new ProjectInitializer(options);
      await initializer.initialize();

      const projectPath = options.projectName;
      const platformYaml = fs.readFileSync(path.join(projectPath, "platform.yaml"), "utf-8");

      expect(platformYaml).toContain("infrastructure_tier: production");
    });

    it("should create project with enterprise tier", async () => {
      const options: InitOptions = {
        projectName: path.join(testProjectsDir, "enterprise-tier"),
        mode: "advanced",
        infrastructureTier: "enterprise",
      };

      const initializer = new ProjectInitializer(options);
      await initializer.initialize();

      const projectPath = options.projectName;
      const platformYaml = fs.readFileSync(path.join(projectPath, "platform.yaml"), "utf-8");

      expect(platformYaml).toContain("infrastructure_tier: enterprise");
    });
  });

  describe("Error Handling", () => {
    it("should fail gracefully when project directory already exists", async () => {
      const projectPath = path.join(testProjectsDir, "existing-project");

      // Create directory first
      fs.mkdirSync(projectPath, { recursive: true });

      const options: InitOptions = {
        projectName: projectPath,
        mode: "simple",
      };

      const initializer = new ProjectInitializer(options);

      await expect(initializer.initialize()).rejects.toThrow();
    });
  });
});
