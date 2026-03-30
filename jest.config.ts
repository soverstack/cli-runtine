import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  testMatch: ["**/*.test.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    "^@commands/(.*)$": "<rootDir>/src/commands/$1",
    "^@validators/(.*)$": "<rootDir>/src/validators/$1",
    "^@utils/(.*)$": "<rootDir>/src/utils/$1",
  },
};

export default config;
