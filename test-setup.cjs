const { snapshot } = require("node:test");
const path = require("node:path");

process.env.NODE_ENV = "test";
process.env.BOT_AUTH_TOKEN = "FAKE_TOKEN";

snapshot.setResolveSnapshotPath((testFile) => {
  const sourceFile = path
    .relative(__dirname, testFile)
    .replaceAll("\\", "/")
    .replace("/dist/test/", "/test/")
    .replace("/dist/_tests/", "/src/_tests/")
    .replace("/dist/", "/")
    .replace(/\.[jt]s$/, ".ts");
  return path.join(__dirname, path.dirname(sourceFile), "__snapshots__", `${path.basename(sourceFile)}.snapshot`);
});
snapshot.setDefaultSnapshotSerializers([
  (value) =>
    typeof value === "string"
      ? value.replace(/\r\n?/g, "\n")
      : JSON.stringify(
          value,
          (_key, entry) =>
            entry && typeof entry === "object" && !Array.isArray(entry)
              ? Object.fromEntries(
                  Object.keys(entry)
                    .sort()
                    .map((key) => [key, entry[key]]),
                )
              : entry,
          2,
        ),
]);
