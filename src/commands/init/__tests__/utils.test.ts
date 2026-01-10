import { InitOptions } from "../utils";

describe("InitOptions", () => {
  it("should accept valid simple mode options", () => {
    const options: InitOptions = {
      projectName: "test-project",
      mode: "simple",
    };

    expect(options.projectName).toBe("test-project");
    expect(options.mode).toBe("simple");
  });

  it("should accept valid advanced mode options", () => {
    const options: InitOptions = {
      projectName: "advanced-project",
      mode: "advanced",
      infrastructureTier: "production",
    };

    expect(options.mode).toBe("advanced");
    expect(options.infrastructureTier).toBe("production");
  });

  it("should accept environments array", () => {
    const options: InitOptions = {
      projectName: "multi-env",
      mode: "advanced",
      environments: ["prod", "dev", "staging"],
    };

    expect(options.environments).toHaveLength(3);
    expect(options.environments).toContain("prod");
  });

  it("should accept generateSshKeys flag", () => {
    const options: InitOptions = {
      projectName: "ssh-project",
      mode: "simple",
      generateSshKeys: true,
    };

    expect(options.generateSshKeys).toBe(true);
  });

  it("should work without optional fields", () => {
    const options: InitOptions = {
      projectName: "minimal",
      mode: "simple",
    };

    expect(options.environments).toBeUndefined();
    expect(options.generateSshKeys).toBeUndefined();
    expect(options.infrastructureTier).toBeUndefined();
  });
});

describe("Project name validation patterns", () => {
  const validNames = [
    "my-project",
    "test123",
    "a",
    "project-name-2024",
    "simple-app",
  ];

  const invalidNames = [
    "My-Project", // uppercase
    "project_name", // underscore
    "project name", // space
    "project.name", // dot
    "project@name", // special char
    "",
  ];

  it("should match valid project names", () => {
    const regex = /^[a-z0-9-]+$/;

    validNames.forEach((name) => {
      expect(regex.test(name)).toBe(true);
    });
  });

  it("should reject invalid project names", () => {
    const regex = /^[a-z0-9-]+$/;

    invalidNames.forEach((name) => {
      expect(regex.test(name)).toBe(false);
    });
  });
});

describe("Environment name validation", () => {
  const validEnvs = ["prod", "dev", "staging", "test", "qa", "uat"];
  const invalidEnvs = ["Prod", "DEV", "test_env", "qa.env"];

  it("should match valid environment names", () => {
    const regex = /^[a-z0-9-]+$/;

    validEnvs.forEach((env) => {
      expect(regex.test(env)).toBe(true);
    });
  });

  it("should reject invalid environment names", () => {
    const regex = /^[a-z0-9-]+$/;

    invalidEnvs.forEach((env) => {
      expect(regex.test(env)).toBe(false);
    });
  });
});
