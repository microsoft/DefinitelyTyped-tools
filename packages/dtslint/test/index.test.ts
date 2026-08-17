/// <reference types="jest" />
import { CompilerOptionsRaw, checkTsconfig } from "../src/checks";
import { assertPackageIsNotDeprecated } from "../src/index";
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
        expect(checkTsconfig(based({ completelyInvented: true }))).toEqual([
          "Unexpected compiler option completelyInvented",
        ]);
      });
      it("allows exactOptionalPropertyTypes: true", () => {
        expect(checkTsconfig(based({ exactOptionalPropertyTypes: true }))).toEqual([]);
      });
      it("allows module: node16", () => {
        expect(checkTsconfig(based({ module: "node16" }))).toEqual([]);
      });
      it("allows `paths`", () => {
        expect(checkTsconfig(based({ paths: { boom: ["../boom/index.d.ts"] } }))).toEqual([]);
      });
      it("disallows missing `module`", () => {
        const compilerOptions = { ...base };
        delete compilerOptions.module;
        expect(checkTsconfig({ compilerOptions, files: ["index.d.ts", "base.test.ts"] })).toEqual([
          'Must specify "module" to `"module": "commonjs"` or `"module": "node16"`.',
        ]);
      });
      it("disallows exactOptionalPropertyTypes: false", () => {
        expect(checkTsconfig(based({ exactOptionalPropertyTypes: false }))).toEqual([
          'When "exactOptionalPropertyTypes" is present, it must be set to `true`.',
        ]);
      });
      it("allows paths: self-reference", () => {
        expect(checkTsconfig(based({ paths: { "react-native": ["./index.d.ts"] } }))).toEqual([]);
      });
      it("allows paths: matching ../reference/index.d.ts", () => {
        expect(checkTsconfig(based({ paths: { "react-native": ["../react-native/index.d.ts"] } }))).toEqual([]);
        expect(
          checkTsconfig(
            based({ paths: { "react-native": ["../react-native/index.d.ts"], react: ["../react/v16/index.d.ts"] } }),
          ),
        ).toEqual([]);
      });
      it("forbids paths: mapping to multiple things", () => {
        expect(
          checkTsconfig(based({ paths: { "react-native": ["./index.d.ts", "../react-native/v0.68/index.d.ts"] } })),
        ).toEqual([`"paths" must map each module specifier to only one file.`]);
      });
      it("allows paths: matching ../reference/version/index.d.ts", () => {
        expect(checkTsconfig(based({ paths: { react: ["../react/v16/index.d.ts"] } }))).toEqual([]);
        expect(checkTsconfig(based({ paths: { "react-native": ["../react-native/v0.69/index.d.ts"] } }))).toEqual([]);
        expect(checkTsconfig(based({ paths: { "react-native": ["../../react-native/v0.69/index.d.ts"] } }))).toEqual(
          [],
        );
      });
      it("forbids paths: mapping to self-contained file", () => {
        expect(checkTsconfig(based({ paths: { "react-native": ["./other.d.ts"] } }))).toEqual([
          `"paths" must map 'react-native' to react-native's index.d.ts.`,
        ]);
      });
      it("forbids paths: mismatching ../NOT/index.d.ts", () => {
        expect(checkTsconfig(based({ paths: { "react-native": ["../cocoa/index.d.ts"] } }))).toEqual([
          `"paths" must map 'react-native' to react-native's index.d.ts.`,
        ]);
      });
      it("forbids paths: mismatching ../react-native/NOT.d.ts", () => {
        expect(checkTsconfig(based({ paths: { "react-native": ["../react-native/other.d.ts"] } }))).toEqual([
          `"paths" must map 'react-native' to react-native's index.d.ts.`,
        ]);
      });
      it("forbids paths: mismatching ../react-native/NOT/index.d.ts", () => {
        expect(checkTsconfig(based({ paths: { "react-native": ["../react-native/deep/index.d.ts"] } }))).toEqual([
          `"paths" must map 'react-native' to react-native's index.d.ts.`,
        ]);
      });
      it("forbids paths: mismatching ../react-native/version/NOT/index.d.ts", () => {
        expect(checkTsconfig(based({ paths: { "react-native": ["../react-native/v0.68/deep/index.d.ts"] } }))).toEqual([
          `"paths" must map 'react-native' to react-native's index.d.ts.`,
        ]);
      });
      it("forbids paths: mismatching ../react-native/version/NOT.d.ts", () => {
        expect(checkTsconfig(based({ paths: { "react-native": ["../react-native/v0.70/other.d.ts"] } }))).toEqual([
          `"paths" must map 'react-native' to react-native's index.d.ts.`,
        ]);
      });
      it("Forbids exclude", () => {
        expect(checkTsconfig({ compilerOptions: base, exclude: ["**/node_modules"] })).toEqual([
          `Use "files" instead of "exclude".`,
        ]);
      });
      it("Forbids include", () => {
        expect(checkTsconfig({ compilerOptions: base, include: ["**/node_modules"] })).toEqual([
          `Use "files" instead of "include".`,
        ]);
      });
      it("Requires files", () => {
        expect(checkTsconfig({ compilerOptions: base })).toEqual([`Must specify "files".`]);
      });
      it("Requires files to contain index.d.ts", () => {
        expect(checkTsconfig({ compilerOptions: base, files: ["package-name.d.ts", "package-name.test.ts"] })).toEqual([
          `"files" list must include "index.d.ts".`,
        ]);
      });
      // it("Requires files to contain .[mc]ts file", () => {
      //   expect(checkTsconfig({ compilerOptions: base, files: ["index.d.ts"] })).toEqual([
      //     `"files" list must include at least one ".ts", ".tsx", ".mts" or ".cts" file for testing.`,
      //   ]);
      // });
      it("Allows files to contain index.d.ts plus a .tsx", () => {
        expect(checkTsconfig({ compilerOptions: base, files: ["index.d.ts", "tests.tsx"] })).toEqual([]);
      });
      it("Allows files to contain index.d.ts plus a .mts", () => {
        expect(checkTsconfig({ compilerOptions: base, files: ["index.d.ts", "tests.mts"] })).toEqual([]);
      });
      it("Allows files to contain index.d.ts plus a .cts", () => {
        expect(checkTsconfig({ compilerOptions: base, files: ["index.d.ts", "tests.cts"] })).toEqual([]);
      });
      it("Allows files to contain ./index.d.ts plus a ./.tsx", () => {
        expect(checkTsconfig({ compilerOptions: base, files: ["./index.d.ts", "./tests.tsx"] })).toEqual([]);
      });
      it("Issues both errors on empty files list", () => {
        expect(checkTsconfig({ compilerOptions: base, files: [] })).toEqual([
          `"files" list must include "index.d.ts".`,
          // `"files" list must include at least one ".ts", ".tsx", ".mts" or ".cts" file for testing.`,
        ]);
      });

      describe("TypeScript 7", () => {
        const fixtures = path.join(__dirname, "fixtures", "typescript7");

        for (const version of ["7.0", "7.1"] as const) {
          it(`checks compiler diagnostics and ExpectType through the TypeScript ${version} IPC API`, async () => {
            const result = await runBuilt<string>("lintTypeScript7", "lintTypeScript7", [
              path.join(fixtures, "fail"),
              ["tsconfig.json"],
              version,
              true,
              null,
            ]);

            expect(result).toContain("compile error TS2322");
            expect(result).toContain("expected type to be:\n  2\ngot:\n  1");
          });

          it(`passes matching TypeScript ${version} ExpectType assertions without invoking ESLint`, async () => {
            await expect(
              runBuilt("lint", "lint", [
                path.join(fixtures, "pass"),
                ["tsconfig.json"],
                version,
                version,
                true,
                true,
                null,
              ]),
            ).resolves.toBeUndefined();
          });
        }

        it("runs ordinary ESLint rules during TypeScript 7-only testing", async () => {
          const result = await runBuilt<string>("lint", "lint", [
            path.join(__dirname, "typescript7-eslint"),
            ["tsconfig.json"],
            "7.0",
            "7.0",
            true,
            false,
            null,
          ]);

          expect(result).toContain("no-var");
          expect(result).toContain("@typescript-eslint/naming-convention");
        });

        it("can use a local TypeScript 7 server executable", async () => {
          const apiPath = typeScriptPackages.resolve("7.1", "unstable/sync");
          const packageRoot = path.resolve(apiPath, "../../../../");
          const executable = path.join(
            path.dirname(packageRoot),
            "@typescript",
            `typescript-${process.platform}-${process.arch}`,
            "lib",
            process.platform === "win32" ? "tsc.exe" : "tsc",
          );

          await expect(
            runBuilt("lint", "lint", [
              path.join(fixtures, "pass"),
              ["tsconfig.json"],
              "local",
              "local",
              true,
              true,
              executable,
            ]),
          ).resolves.toBeUndefined();
        });
      });
    });
    describe("assertPackageIsNotDeprecated", () => {
      it("disallows packages that are in notNeededPackages.json", () => {
        expect(() => assertPackageIsNotDeprecated("foo", '{ "packages": { "foo": { } } }')).toThrow(
          "notNeededPackages.json has an entry for foo.",
        );
      });
      it("allows packages that are not in notNeededPackages.json", () => {
        expect(assertPackageIsNotDeprecated("foo", '{ "packages": { "bar": { } } }')).toBeUndefined();
      });
    });
  });
});
