module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["<rootDir>/packages/*/test/**/*.test.ts"],
  globals: {
    "ts-jest": {
      tsConfig: "./tsconfig.test.json",
      diagnostics: false
    }
  }
};
