/** @type {import("knip").KnipConfig} */
const config = {
  workspaces: {
    ".": {
      ignoreBinaries: ["only-allow"],
    },
    "packages/definitions-parser": {
      entry: "src/index.ts",
      project: "**/*.ts",
    },
    "packages/dts-critic": {
      entry: ["develop.ts", "dt.ts", "index.ts"],
      project: "**/*.ts",
    },
    "packages/dtslint": {
      entry: ["src/index.ts", "src/updateConfig.ts", "src/rules/*.ts"],
      project: "**/*.ts",
      ignoreDependencies: [
        "@typescript-eslint/eslint-plugin",
        "@typescript-eslint/parser",
        "@typescript-eslint/types",
        "@typescript-eslint/utils",
        "eslint-plugin-import",
      ],
    },
    "packages/dtslint-runner": {
      entry: ["src/index.ts", "src/post-results.ts"],
      project: "**/*.ts",
    },
    "packages/eslint-plugin": {
      entry: "src/index.ts",
      project: "**/*.ts",
      ignoreDependencies: ["@definitelytyped/eslint-plugin"],
    },
    "packages/header-parser": {
      entry: "src/index.ts",
      project: "**/*.ts",
    },
    "packages/publisher": {
      entry: [
        "src/calculate-versions.ts",
        "src/clean.ts",
        "src/full.ts",
        "src/generate-packages.ts",
        "src/get-definitely-typed.ts",
        "src/index.ts",
        "src/main.ts",
        "src/publish-packages.ts",
        "src/publish-registry.ts",
        "src/run.ts",
        "src/tester/test.ts",
        "src/validate.ts",
      ],
      project: "**/*.ts",
    },
    "packages/retag": {
      entry: "src/index.ts",
      project: "**/*.ts",
    },
    "packages/typescript-packages": {
      entry: "src/index.ts",
      project: "**/*.ts",
      ignoreDependencies: [/typescript-.*/],
    },
    "packages/typescript-versions": {
      entry: "src/index.ts",
      project: "**/*.ts",
    },
    "packages/utils": {
      entry: ["src/index.ts", "src/types/*.ts"],
      project: "**/*.ts",
      ignoreDependencies: ["@qiwi/npm-types"],
    },
  },
  ignore: ["**/fixtures", "**/testsource", "**/dtslint/test/*/**", "**/*.d.ts"],
  ignoreExportsUsedInFile: true,
};

module.exports = config;
