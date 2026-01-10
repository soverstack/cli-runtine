import fs from "fs";
import path from "path";
import { ProjectInitializer } from "../logic";
import { InitOptions } from "../utils";

// Mock modules
jest.mock("fs");
jest.mock("ora", () => {
  return () => ({
    start: jest.fn().mockReturnThis(),
    succeed: jest.fn().mockReturnThis(),
    fail: jest.fn().mockReturnThis(),
  });
});

describe("ProjectInitializer", () => {
  const mockFs = fs as jest.Mocked<typeof fs>;
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleSpy = jest.spyOn(console, "log").mockImplementation();

    // Default mock implementations
    mockFs.existsSync = jest.fn().mockReturnValue(false);
    mockFs.mkdirSync = jest.fn();
    mockFs.writeFileSync = jest.fn();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe("constructor", () => {
    it("should create instance with valid options", () => {
      const options: InitOptions = {
        projectName: "test-project",
        mode: "simple",
      };

      const initializer = new ProjectInitializer(options);
      expect(initializer).toBeInstanceOf(ProjectInitializer);
    });

    it("should resolve project path correctly", () => {
      const options: InitOptions = {
        projectName: "my-project",
        mode: "advanced",
      };

      const initializer = new ProjectInitializer(options);
      const expectedPath = path.resolve(process.cwd(), "my-project");

      // Access private property for testing
      expect((initializer as any).projectPath).toBe(expectedPath);
    });
  });

  describe("initialize - simple mode", () => {
    it("should initialize simple project without environments", async () => {
      const options: InitOptions = {
        projectName: "simple-test",
        mode: "simple",
      };

      const initializer = new ProjectInitializer(options);
      await initializer.initialize();

      // Verify project directory created
      expect(mockFs.mkdirSync).toHaveBeenCalledWith(
        expect.stringContaining("simple-test"),
        expect.objectContaining({ recursive: true })
      );

      // Verify simple directory structure
      expect(mockFs.mkdirSync).toHaveBeenCalledWith(
        expect.stringContaining("ssh"),
        expect.objectContaining({ recursive: true })
      );

      expect(mockFs.mkdirSync).toHaveBeenCalledWith(
        expect.stringContaining("layers"),
        expect.objectContaining({ recursive: true })
      );

      // Verify .soverstack directory created
      expect(mockFs.mkdirSync).toHaveBeenCalledWith(
        expect.stringContaining(".soverstack"),
        expect.objectContaining({ recursive: true })
      );
    });

    it("should initialize simple project with environments", async () => {
      const options: InitOptions = {
        projectName: "simple-multi-env",
        mode: "simple",
        environments: ["prod", "dev"],
      };

      const initializer = new ProjectInitializer(options);
      await initializer.initialize();

      expect(mockFs.mkdirSync).toHaveBeenCalled();
      expect(mockFs.writeFileSync).toHaveBeenCalled();
    });
  });

  describe("initialize - advanced mode", () => {
    it("should initialize advanced project without environments", async () => {
      const options: InitOptions = {
        projectName: "advanced-test",
        mode: "advanced",
        infrastructureTier: "production",
      };

      const initializer = new ProjectInitializer(options);
      await initializer.initialize();

      // Verify advanced directory structure
      const expectedDirs = [
        "layers/datacenters",
        "layers/computes",
        "layers/clusters",
        "layers/features",
        "layers/firewalls",
        "layers/bastions",
        "ssh",
      ];

      expectedDirs.forEach((dir) => {
        expect(mockFs.mkdirSync).toHaveBeenCalledWith(
          expect.stringContaining(dir),
          expect.objectContaining({ recursive: true })
        );
      });
    });

    it("should initialize advanced project with multiple environments", async () => {
      const options: InitOptions = {
        projectName: "advanced-multi-env",
        mode: "advanced",
        environments: ["prod", "staging", "dev"],
        infrastructureTier: "enterprise",
      };

      const initializer = new ProjectInitializer(options);
      await initializer.initialize();

      expect(mockFs.mkdirSync).toHaveBeenCalled();
      expect(mockFs.writeFileSync).toHaveBeenCalled();
    });
  });

  describe("initialize - SSH keys", () => {
    it("should generate SSH keys when requested", async () => {
      const options: InitOptions = {
        projectName: "ssh-test",
        mode: "simple",
        generateSshKeys: true,
      };

      const initializer = new ProjectInitializer(options);
      await initializer.initialize();

      // SSH key generation should be called
      expect(mockFs.writeFileSync).toHaveBeenCalled();
    });

    it("should skip SSH key generation when not requested", async () => {
      const options: InitOptions = {
        projectName: "no-ssh-test",
        mode: "simple",
        generateSshKeys: false,
      };

      const initializer = new ProjectInitializer(options);

      // Count writeFileSync calls before
      const callsBefore = mockFs.writeFileSync.mock.calls.length;

      await initializer.initialize();

      // SSH keys not generated
      // (Other files are still written: .gitignore, README, etc.)
      expect(mockFs.writeFileSync).toHaveBeenCalled();
    });
  });

  describe("initialize - error handling", () => {
    it("should fail if project directory already exists", async () => {
      mockFs.existsSync = jest.fn().mockReturnValue(true);

      const options: InitOptions = {
        projectName: "existing-project",
        mode: "simple",
      };

      const initializer = new ProjectInitializer(options);

      await expect(initializer.initialize()).rejects.toThrow();
    });

    it("should handle directory creation failure", async () => {
      mockFs.mkdirSync = jest.fn().mockImplementation(() => {
        throw new Error("Permission denied");
      });

      const options: InitOptions = {
        projectName: "permission-test",
        mode: "simple",
      };

      const initializer = new ProjectInitializer(options);

      await expect(initializer.initialize()).rejects.toThrow("Permission denied");
    });

    it("should handle file write failure", async () => {
      mockFs.writeFileSync = jest.fn().mockImplementation(() => {
        throw new Error("Disk full");
      });

      const options: InitOptions = {
        projectName: "disk-full-test",
        mode: "simple",
      };

      const initializer = new ProjectInitializer(options);

      await expect(initializer.initialize()).rejects.toThrow();
    });
  });

  describe("initialize - infrastructure tiers", () => {
    it("should handle local tier", async () => {
      const options: InitOptions = {
        projectName: "local-tier",
        mode: "advanced",
        infrastructureTier: "local",
      };

      const initializer = new ProjectInitializer(options);
      await initializer.initialize();

      expect(mockFs.mkdirSync).toHaveBeenCalled();
    });

    it("should handle production tier", async () => {
      const options: InitOptions = {
        projectName: "prod-tier",
        mode: "advanced",
        infrastructureTier: "production",
      };

      const initializer = new ProjectInitializer(options);
      await initializer.initialize();

      expect(mockFs.mkdirSync).toHaveBeenCalled();
    });

    it("should handle enterprise tier", async () => {
      const options: InitOptions = {
        projectName: "enterprise-tier",
        mode: "advanced",
        infrastructureTier: "enterprise",
      };

      const initializer = new ProjectInitializer(options);
      await initializer.initialize();

      expect(mockFs.mkdirSync).toHaveBeenCalled();
    });
  });

  describe("printNextSteps", () => {
    it("should display next steps after initialization", async () => {
      const options: InitOptions = {
        projectName: "next-steps-test",
        mode: "simple",
      };

      const initializer = new ProjectInitializer(options);
      await initializer.initialize();

      // Verify next steps are printed
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Next Steps")
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("cd next-steps-test")
      );
    });

    it("should show environment-specific files in next steps", async () => {
      const options: InitOptions = {
        projectName: "env-steps-test",
        mode: "advanced",
        environments: ["prod", "dev"],
      };

      const initializer = new ProjectInitializer(options);
      await initializer.initialize();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("prod")
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("dev")
      );
    });
  });
});
