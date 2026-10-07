import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CompilerOptionsRaw, checkTsconfig } from "../src/checks";
import { assertPackageIsNotDeprecated, getTypeScriptTestRanges } from "../src/index";
import * as typeScriptPackages from "@definitelytyped/typescript-packages";
import { execFile } from "child_process";
import path from "path";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

async function runBuilt<T>(moduleName: string, exportName: string, args: readonly unknown[]): Promise<T | undefined> {
  const modulePath = path.resolve(__dirname, `../dist/${moduleName}.js`);
  const script = `
const fn = require(process.argv[1])[process.argv[2]];
Promise.resolve(fn(...JSON.parse(process.argv[3]))).then(
  result => process.stdout.write(JSON.stringify({ result })),
  error => {
    console.error(error?.stack ?? error);
    process.exitCode = 1;
  },
);`;
  const { stdout } = await execFileAsync(process.execPath, [
    "-e",
    script,
    modulePath,
    exportName,
    JSON.stringify(args),
  ]);
  return (JSON.parse(stdout) as { result?: T }).result;
}

describe("getTypeScriptTestRanges", () => {
  it("tests through the latest compiler in its typesVersions directory", () => {
    assert.deepEqual(getTypeScriptTestRanges(["6.0", "7.1"]), [
      { low: "5.6", high: "6.0", directoryVersion: "6.0" },
      { low: "7.0", high: "7.1", directoryVersion: "7.1" },
    ]);
  });

  it("uses the root definition when no future directory supersedes it", () => {
    assert.deepEqual(getTypeScriptTestRanges(["6.0"]), [
      { low: "5.6", high: "6.0", directoryVersion: "6.0" },
      { low: "7.0", high: "7.1" },
    ]);
  });
});

describe("dtslint", () => {
  const base: CompilerOptionsRaw = {
    module: "commonjs",
    lib: ["es6"],
    noImplicitAny: true,
    noImplicitThis: true,
    strictNullChecks: true,
    strictFunctionTypes: true,
    types: [],
    noEmit: true,
    forceConsistentCasingInFileNames: true,
  };
  function based(extra: object) {
    return { compilerOptions: { ...base, ...extra }, files: ["index.d.ts", "base.test.ts"] };
  }
  describe("checks", () => {
    describe("checkTsconfig", () => {
      it("disallows unknown compiler options", () => {
        assert.deepEqual(checkTsconfig(based({ completelyInvented: true })), [
          "Unexpected compiler option completelyInvented",
        ]);
      });

      it("allows exactOptionalPropertyTypes: true", () => {
        assert.deepEqual(checkTsconfig(based({ exactOptionalPropertyTypes: true })), []);
      });
      it("allows module: node16", () => {
        assert.deepEqual(checkTsconfig(based({ module: "node16" })), []);
      });
      it("allows `paths`", () => {
        assert.deepEqual(checkTsconfig(based({ paths: { boom: ["../boom/index.d.ts"] } })), []);
      });
      it("disallows missing `module`", () => {
        const compilerOptions = { ...base };
        delete compilerOptions.module;
        assert.deepEqual(checkTsconfig({ compilerOptions, files: ["index.d.ts", "base.test.ts"] }), [
          'Must specify "module" to `"module": "commonjs"` or `"module": "node16"`.',
        ]);
      });
      it("disallows exactOptionalPropertyTypes: false", () => {
        assert.deepEqual(checkTsconfig(based({ exactOptionalPropertyTypes: false })), [
          'When "exactOptionalPropertyTypes" is present, it must be set to `true`.',
        ]);
      });
      it("allows paths: self-reference", () => {
        assert.deepEqual(checkTsconfig(based({ paths: { "react-native": ["./index.d.ts"] } })), []);
      });
      it("allows paths: matching ../reference/index.d.ts", () => {
        assert.deepEqual(checkTsconfig(based({ paths: { "react-native": ["../react-native/index.d.ts"] } })), []);
        assert.deepEqual(
          checkTsconfig(
            based({ paths: { "react-native": ["../react-native/index.d.ts"], react: ["../react/v16/index.d.ts"] } }),
          ),
          [],
        );
      });
      it("forbids paths: mapping to multiple things", () => {
        assert.deepEqual(
          checkTsconfig(based({ paths: { "react-native": ["./index.d.ts", "../react-native/v0.68/index.d.ts"] } })),
          [`"paths" must map each module specifier to only one file.`],
        );
      });
      it("allows paths: matching ../reference/version/index.d.ts", () => {
        assert.deepEqual(checkTsconfig(based({ paths: { react: ["../react/v16/index.d.ts"] } })), []);
        assert.deepEqual(checkTsconfig(based({ paths: { "react-native": ["../react-native/v0.69/index.d.ts"] } })), []);
        assert.deepEqual(
          checkTsconfig(based({ paths: { "react-native": ["../../react-native/v0.69/index.d.ts"] } })),
          [],
        );
      });
      it("forbids paths: mapping to self-contained file", () => {
        assert.deepEqual(checkTsconfig(based({ paths: { "react-native": ["./other.d.ts"] } })), [
          `"paths" must map 'react-native' to react-native's index.d.ts.`,
        ]);
      });
      it("forbids paths: mismatching ../NOT/index.d.ts", () => {
        assert.deepEqual(checkTsconfig(based({ paths: { "react-native": ["../cocoa/index.d.ts"] } })), [
          `"paths" must map 'react-native' to react-native's index.d.ts.`,
        ]);
      });
      it("forbids paths: mismatching ../react-native/NOT.d.ts", () => {
        assert.deepEqual(checkTsconfig(based({ paths: { "react-native": ["../react-native/other.d.ts"] } })), [
          `"paths" must map 'react-native' to react-native's index.d.ts.`,
        ]);
      });
      it("forbids paths: mismatching ../react-native/NOT/index.d.ts", () => {
        assert.deepEqual(checkTsconfig(based({ paths: { "react-native": ["../react-native/deep/index.d.ts"] } })), [
          `"paths" must map 'react-native' to react-native's index.d.ts.`,
        ]);
      });
      it("forbids paths: mismatching ../react-native/version/NOT/index.d.ts", () => {
        assert.deepEqual(
          checkTsconfig(based({ paths: { "react-native": ["../react-native/v0.68/deep/index.d.ts"] } })),
          [`"paths" must map 'react-native' to react-native's index.d.ts.`],
        );
      });
      it("forbids paths: mismatching ../react-native/version/NOT.d.ts", () => {
        assert.deepEqual(checkTsconfig(based({ paths: { "react-native": ["../react-native/v0.70/other.d.ts"] } })), [
          `"paths" must map 'react-native' to react-native's index.d.ts.`,
        ]);
      });
      it("Forbids exclude", () => {
        assert.deepEqual(checkTsconfig({ compilerOptions: base, exclude: ["**/node_modules"] }), [
          `Use "files" instead of "exclude".`,
        ]);
      });
      it("Forbids include", () => {
        assert.deepEqual(checkTsconfig({ compilerOptions: base, include: ["**/node_modules"] }), [
          `Use "files" instead of "include".`,
        ]);
      });
      it("Requires files", () => {
        assert.deepEqual(checkTsconfig({ compilerOptions: base }), [`Must specify "files".`]);
      });
      it("Requires files to contain index.d.ts", () => {
        assert.deepEqual(
          checkTsconfig({ compilerOptions: base, files: ["package-name.d.ts", "package-name.test.ts"] }),
          [`"files" list must include "index.d.ts".`],
        );
      });
      // it("Requires files to contain .[mc]ts file", () => {
      //   expect(checkTsconfig({ compilerOptions: base, files: ["index.d.ts"] })).toEqual([
      //     `"files" list must include at least one ".ts", ".tsx", ".mts" or ".cts" file for testing.`,
      //   ]);
      // });
      it("Allows files to contain index.d.ts plus a .tsx", () => {
        assert.deepEqual(checkTsconfig({ compilerOptions: base, files: ["index.d.ts", "tests.tsx"] }), []);
      });
      it("Allows files to contain index.d.ts plus a .mts", () => {
        assert.deepEqual(checkTsconfig({ compilerOptions: base, files: ["index.d.ts", "tests.mts"] }), []);
      });
      it("Allows files to contain index.d.ts plus a .cts", () => {
        assert.deepEqual(checkTsconfig({ compilerOptions: base, files: ["index.d.ts", "tests.cts"] }), []);
      });
      it("Allows files to contain ./index.d.ts plus a ./.tsx", () => {
        assert.deepEqual(checkTsconfig({ compilerOptions: base, files: ["./index.d.ts", "./tests.tsx"] }), []);
      });
      it("Issues both errors on empty files list", () => {
        assert.deepEqual(checkTsconfig({ compilerOptions: base, files: [] }), [
          `"files" list must include "index.d.ts".`,
          // `"files" list must include at least one ".ts", ".tsx", ".mts" or ".cts" file for testing.`,
        ]);
      });

      describe("Corsa", () => {
        const fixtures = path.join(__dirname, "fixtures", "corsa");

        for (const version of ["7.0", "7.1"] as const) {
          it(`checks compiler diagnostics and ExpectType through the TypeScript ${version} IPC API`, async () => {
            const result = await runBuilt<string>("lintCorsa", "lintCorsaVersions", [
              path.join(fixtures, "fail"),
              ["tsconfig.json"],
              [version],
              true,
              null,
            ]);
            assert.ok(result);

            assert.ok(result.includes("compile error TS2322"));
            assert.ok(
              result.includes(
                "  The types of 'outer.inner' are incompatible between these types.\n" +
                  "    Type 'number' is not assignable to type 'string'.",
              ),
            );
            assert.ok(result.includes("compile error TS2578"));
            assert.equal(result?.match(/compile error TS2578/g)?.length, version === "7.0" ? 1 : 2);
            assert.ok(result.includes("expected type to be:\n  2\ngot:\n  1"));
            assert.ok(
              result.includes("expected type to be:\n  { (value: number): number; (value: string): string; }\ngot:"),
            );
            assert.ok(
              result.includes(
                "expected type to be:\n  { method(value: number): number; method(value: string): string; }\ngot:",
              ),
            );
          });

          it(`passes matching TypeScript ${version} ExpectType assertions without invoking ESLint`, async () => {
            assert.equal(
              await runBuilt("lint", "lint", [
                path.join(fixtures, "pass"),
                ["tsconfig.json"],
                version,
                version,
                true,
                true,
                null,
              ]),
              undefined,
            );
          });
        }

        it("reports and deduplicates Corsa failures across tsconfigs", async () => {
          const result = await runBuilt<string>("lintCorsa", "lintCorsaVersions", [
            path.join(fixtures, "fail"),
            ["tsconfig.json", "tsconfig.alternate.json"],
            ["7.0"],
            true,
            null,
          ]);
          assert.ok(result);

          assert.ok(result.includes("TypeScript@7.0 tsconfig.alternate.json, 7.0 tsconfig.json compile error TS2322"));
          assert.ok(
            result.includes(
              "TypeScript@7.0 tsconfig.alternate.json, 7.0 tsconfig.json expected type to be:\n  2\ngot:\n  1",
            ),
          );
          assert.equal(result?.match(/compile error TS2322/g)?.length, 1);
          assert.equal(result?.match(/expected type to be:\n  2\ngot:\n  1/g)?.length, 1);
        });

        it("reports and deduplicates Corsa failures across versions", { timeout: 30_000 }, async () => {
          const result = await runBuilt<string>("lint", "lint", [
            path.join(fixtures, "fail"),
            ["tsconfig.json"],
            "7.0",
            "7.1",
            true,
            true,
            null,
          ]);
          assert.ok(result);

          assert.ok(result.includes("TypeScript@7.0, 7.1 compile error TS2322"));
          assert.equal(result?.match(/compile error TS2322/g)?.length, 1);
        });

        it("reports files excluded from every alternate tsconfig", async () => {
          const result = await runBuilt<string>("lint", "lint", [
            path.join(fixtures, "partial"),
            ["tsconfig.alternate.json"],
            "7.0",
            "7.0",
            true,
            true,
            null,
          ]);
          assert.ok(result);

          assert.ok(result.includes("excluded.ts:1:1"));
          assert.ok(result.includes("TypeScript@7.0 could not find a tsconfig that includes this file."));
        });

        it("runs ordinary ESLint rules during Corsa-only testing", { timeout: 30_000 }, async () => {
          const result = await runBuilt<string>("lint", "lint", [
            path.join(__dirname, "corsa-eslint"),
            ["tsconfig.json"],
            "7.0",
            "7.0",
            true,
            false,
            null,
          ]);
          assert.ok(result);

          assert.ok(result.includes("no-var"));
          assert.ok(result.includes("@typescript-eslint/naming-convention"));
        });

        it("can use a local Corsa package", { timeout: 30_000 }, async () => {
          const packageRoot = path.dirname(typeScriptPackages.resolve("7.0", "package.json"));

          assert.equal(
            await runBuilt("lint", "lint", [
              path.join(fixtures, "pass"),
              ["tsconfig.json"],
              "local",
              "local",
              true,
              true,
              packageRoot,
            ]),
            undefined,
          );

          const result = await runBuilt<string>("lintCorsa", "lintCorsaVersions", [
            path.join(fixtures, "fail"),
            ["tsconfig.json"],
            ["local"],
            true,
            packageRoot,
          ]);
          assert.ok(result);
          assert.ok(result.includes("TypeScript@local compile error TS2578"));
          assert.equal(result?.match(/compile error TS2578/g)?.length, 1);
        });
      });
    });
    describe("assertPackageIsNotDeprecated", () => {
      it("disallows packages that are in notNeededPackages.json", () => {
        assert.throws(
          () => assertPackageIsNotDeprecated("foo", '{ "packages": { "foo": { } } }'),
          /notNeededPackages\.json has an entry for foo\./,
        );
      });
      it("allows packages that are not in notNeededPackages.json", () => {
        assert.equal(assertPackageIsNotDeprecated("foo", '{ "packages": { "bar": { } } }'), undefined);
      });
    });
  });
});
