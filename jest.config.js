module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  modulePathIgnorePatterns: ["packages\\/publisher\\/output", "testsource", "fixtures"],
  testMatch: ["<rootDir>/packages/*/test/**/*.test.ts", "<rootDir>/packages/dts-critic/index.test.ts", "<rootDir>/packages/mergebot/src/_tests/*.test.ts"],
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        tsconfig: "<rootDir>/tsconfig.test.json",
        diagnostics: false,
      },
    ],
  },
};
