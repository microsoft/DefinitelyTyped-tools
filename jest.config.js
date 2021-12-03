module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  modulePathIgnorePatterns: ["packages\\/publisher\\/output"],
  testMatch: ["<rootDir>/packages/*/test/**/*.test.ts", "<rootDir>/packages/dts-critic/index.test.ts"],
  globals: {
    "ts-jest": {
      tsConfig: "<rootDir>/tsconfig.test.json",
      diagnostics: false
    }
  }
};
