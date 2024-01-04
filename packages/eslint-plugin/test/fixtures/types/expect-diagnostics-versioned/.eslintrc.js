module.exports = {
  overrides: [
    {
      files: ["*.ts", "*.cts", "*.mts", "*.tsx"],
      rules: {
        "@definitelytyped/expect": ["error", { versionsToTest: [{ versionName: "x.y", path: "typescript" }] }],
      },
    },
  ]
};
