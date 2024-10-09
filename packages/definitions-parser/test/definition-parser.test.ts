import { DiskFS } from "@definitelytyped/utils";
import path from "path";
import { getTypingInfo } from "../src/lib/definition-parser";
import { createMockDT } from "../src/mocks";

describe(getTypingInfo, () => {
  it("keys data by major.minor version", async () => {
    const dt = createMockDT();
    dt.addOldVersionOfPackage("jquery", "1.42", "1.42.9999");
    dt.addOldVersionOfPackage("jquery", "2", "2.0.9999");
    const info = await getTypingInfo("jquery", dt.fs);

    expect(Object.keys(info!).sort()).toEqual(["1.42", "2.0", "3.3"]);
  });

  it("works for a package with dependencies", async () => {
    const dt = createMockDT();
    const info = await getTypingInfo("has-dependency", dt.fs);
    expect("errors" in info!).toBeFalsy();
  });

  it("works for non-module files with empty statements", async () => {
    const dt = createMockDT();
    const d = dt.pkgDir("example");
    d.set("index.d.ts", `;;`);

    d.set(
      "tsconfig.json",
      JSON.stringify({
        files: ["index.d.ts"],
        compilerOptions: {},
      }),
    );
    d.set(
      "package.json",
      JSON.stringify({
        private: true,
        name: "@types/example",
        version: "25.0.9999",
        projects: ["https://github.com/ckeditor/ckeditor5/tree/master/packages/ckeditor5-engine"],
        owners: [
          {
            name: "Example",
            url: "https://example.com/example",
          },
        ],
        devDependencies: {
          "@types/example": "workspace:.",
        },
      }),
    );

    const info = await getTypingInfo("example", dt.fs);
    expect("errors" in info!).toBeFalsy();
  });
  it("works for a scoped package with scoped older dependencies", async () => {
    const dt = createMockDT();
    const scopedWithOlderScopedDependency = dt.pkgDir("ckeditor__ckeditor5-engine");
    scopedWithOlderScopedDependency.set("index.d.ts", `import * as utils from '@ckeditor/ckeditor5-utils';`);

    scopedWithOlderScopedDependency.set(
      "tsconfig.json",
      JSON.stringify({
        files: ["index.d.ts"],
        compilerOptions: {},
      }),
    );
    scopedWithOlderScopedDependency.set(
      "package.json",
      JSON.stringify({
        private: true,
        name: "@types/ckeditor__ckeditor5-engine",
        version: "25.0.9999",
        projects: ["https://github.com/ckeditor/ckeditor5/tree/master/packages/ckeditor5-engine"],
        owners: [
          {
            name: "Example",
            url: "https://zombo.com/ñ",
          },
        ],
        dependencies: {
          "@types/ckeditor__ckeditor5-utils": "10.0.9999",
        },
        devDependencies: {
          "@types/ckeditor__ckeditor5-engine": "workspace:.",
        },
      }),
    );

    const olderScopedPackage = dt.pkgDir("ckeditor__ckeditor5-utils");
    olderScopedPackage.set(
      "index.d.ts",
      `
export function myFunction(arg:string): string;
 `,
    );
    olderScopedPackage.set(
      "tsconfig.json",
      JSON.stringify({
        files: ["index.d.ts"],
        compilerOptions: {},
      }),
    );
    olderScopedPackage.set(
      "package.json",
      JSON.stringify({
        private: true,
        name: "@types/ckeditor__ckeditor5-utils",
        version: "25.0.9999",
        projects: ["https://github.com/ckeditor/ckeditor5/tree/master/packages/ckeditor5-utils"],
        owners: [
          {
            name: "Example",
            githubUsername: "ñ",
          },
        ],
        dependencies: {},
        devDependencies: {
          "@types/ckeditor__ckeditor5-utils": "workspace:.",
        },
      }),
    );
    dt.addOldVersionOfPackage("@ckeditor/ckeditor5-utils", "10", "10.0.9999");

    const info = await getTypingInfo("ckeditor__ckeditor5-engine", dt.fs);
    expect("errors" in info!).toBeFalsy();
  });

  it("allows path mapping to node/buffer", async () => {
    // Actually, the default seup already has 'has-older-test-dependency', so probably doesn't need an explicit test
    const dt = createMockDT();
    const safer = dt.pkgDir("safer");
    safer.set(
      "index.d.ts",
      `
/// <reference types="node" />
export * from 'buffer';
`,
    );
    safer.set("safer-tests.ts", "");
    safer.set(
      "tsconfig.json",
      `{
    "compilerOptions": {
        "module": "commonjs",
        "lib": [
            "es6"
        ],
        "noImplicitAny": true,
        "noImplicitThis": true,
        "strictFunctionTypes": true,
        "strictNullChecks": true,
        "baseUrl": "../",
        "typeRoots": [
            "../"
        ],
        "types": [],
        "paths": {
            "buffer": [
                "node/buffer"
            ]
        },
        "noEmit": true,
        "forceConsistentCasingInFileNames": true
    },
    "files": [
        "index.d.ts",
        "safer-tests.ts"
    ]
} `,
    );
    safer.set(
      "package.json",
      JSON.stringify({
        private: true,
        name: "@types/safer",
        version: "1.0.9999",
        projects: ["https://github.com/safer/safer"],
        owners: [
          {
            name: "Noone",
            githubUsername: "noone",
          },
        ],
        dependencies: {
          "@types/node": "*",
        },
        devDependencies: {
          "@types/safer": "workspace:.",
        },
      }),
    );

    const info = await getTypingInfo("safer", dt.fs);
    if ("errors" in info!) {
      throw new Error(info.errors.join("\n"));
    }
    expect(info!["1.0"]).toBeDefined();
    expect(info!["1.0"].dependencies).toEqual({ "@types/node": "*" });
  });
  it("errors on arbitrary path mapping", () => {});
  it("supports node_modules passthrough path mapping", async () => {
    const dt = createMockDT();
    const webpack = dt.pkgDir("webpack");
    webpack.set(
      "index.d.ts",
      `// Type definitions for webpack 5.2
// Project: https://github.com/webpack/webpack
// Definitions by: Qubo <https://github.com/tkqubo>
// Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped

/// <reference types="node" />
import webpack = require('webpack');
export = webpack;
`,
    );
    webpack.set(
      "webpack-tests.ts",
      `
import webpack = require('webpack');
const a = new webpack.AutomaticPrefetchPlugin();
`,
    );
    webpack.set(
      "tsconfig.json",
      `{
    "compilerOptions": {
        "module": "commonjs",
        "lib": [
            "es6",
            "dom"
        ],
        "target": "es6",
        "noImplicitAny": true,
        "noImplicitThis": true,
        "strictNullChecks": true,
        "strictFunctionTypes": true,
        "baseUrl": "../",
        "typeRoots": [
            "../"
        ],
        "paths": {
            "webpack": [
                "./node_modules/webpack"
            ],
            "tapable": [
                "./node_modules/tapable"
            ]
        },
        "types": [],
        "noEmit": true,
        "forceConsistentCasingInFileNames": true
    },
    "files": [
        "index.d.ts",
        "webpack-tests.ts"
    ]
}`,
    );
    webpack.set(
      "package.json",
      JSON.stringify({
        private: true,
        name: "@types/webpack",
        version: "5.2.9999",
        projects: ["https://github.com/webpack/webpack"],
        owners: [
          {
            name: "Qubo",
            githubUsername: "tkqubo",
          },
        ],
        devDependencies: {
          "@types/webpack": "workspace:.",
        },
      }),
    );

    const info = await getTypingInfo("webpack", dt.fs);
    expect("errors" in info!).toBeFalsy();
  });

  it("allows references to old versions of self", async () => {
    const info = await getTypingInfo(
      "fail",
      new DiskFS(path.resolve(__dirname, "fixtures/allows-references-to-old-versions-of-self/")),
    );
    expect("errors" in info!).toBeFalsy();
  });

  it("omits test dependencies on modules declared in index.d.ts", async () => {
    const dt = createMockDT();
    const ember = dt.pkgDir("ember");
    ember.set(
      "index.d.ts",
      `/// <reference types="jquery" />
declare module '@ember/routing/route' {
}
declare module '@ember/routing/rotorooter' {
}
`,
    );
    ember.set(
      "ember-tests.ts",
      `
import route = require('@ember/routing/route');
`,
    );
    ember.set(
      "tsconfig.json",
      `{
    "compilerOptions": {
        "module": "commonjs",
        "lib": [
            "es6",
            "dom"
        ],
        "target": "es6",
        "noImplicitAny": true,
        "noImplicitThis": true,
        "strictNullChecks": true,
        "strictFunctionTypes": true,
        "baseUrl": "../",
        "types": [],
        "noEmit": true,
        "forceConsistentCasingInFileNames": true
    },
    "files": [
        "index.d.ts",
        "ember-tests.ts"
    ]
}`,
    );
    ember.set(
      "package.json",
      `{
    "private": true,
    "name": "@types/ember",
    "version": "2.8.9999",
    "dependencies": {
        "@types/ember__routing": "*"
    },
    "devDependencies": {
        "@types/ember": "workspace:."
    },
    "projects": [
        "https://github.com/ember"
    ],
    "owners": [
        {
            "name": "Chris Krycho",
            "githubUsername": "chriskrycho"
        }
    ]
}`,
    );

    const info = (await getTypingInfo("ember", dt.fs))!;
    if ("errors" in info) {
      throw new Error(info.errors.join("\n"));
    }
    expect(info["2.8"].devDependencies).toEqual({ "@types/ember": "workspace:." });
  });

  it("doesn't omit dependencies if only some deep modules are declared", async () => {
    const info = (await getTypingInfo(
      "styled-components-react-native",
      new DiskFS(path.resolve(__dirname, "fixtures/doesnt-omit-dependencies-if-only-some-deep-modules-are-declared/")),
    ))!;
    if ("errors" in info) {
      throw new Error(info.errors.join("\n"));
    }
    expect(info["5.1"].dependencies).toEqual({ "@types/styled-components": "*" });
  });

  describe("concerning multiple versions", () => {
    it("records what the version directory looks like on disk", async () => {
      const dt = createMockDT();
      dt.addOldVersionOfPackage("jquery", "2", "2.0.9999");
      dt.addOldVersionOfPackage("jquery", "1.5", "1.5.9999");
      const info = await getTypingInfo("jquery", dt.fs);

      expect(info).toEqual({
        "1.5": expect.objectContaining({
          libraryVersionDirectoryName: "1.5",
        }),
        "2.0": expect.objectContaining({
          libraryVersionDirectoryName: "2",
        }),
        "3.3": expect.objectContaining({
          // The latest version does not have its own version directory
          libraryVersionDirectoryName: undefined,
        }),
      });
    });

    describe("validation thereof", () => {
      it("throws if a directory exists for the latest major version", () => {
        const dt = createMockDT();
        dt.addOldVersionOfPackage("jquery", "3", "3.0.9999");

        return expect(getTypingInfo("jquery", dt.fs)).resolves.toEqual({
          errors: [
            "The latest version of the 'jquery' package is 3.3, so the subdirectory 'v3' is not allowed; " +
              "since it applies to any 3.* version, up to and including 3.3.",
          ],
        });
      });

      it("throws if a directory exists for the latest minor version", () => {
        const dt = createMockDT();
        dt.addOldVersionOfPackage("jquery", "3.3", "3.3.9999");

        return expect(getTypingInfo("jquery", dt.fs)).resolves.toEqual({
          errors: ["The latest version of the 'jquery' package is 3.3, so the subdirectory 'v3.3' is not allowed."],
        });
      });

      it("does not throw when a minor version is older than the latest", () => {
        const dt = createMockDT();
        dt.addOldVersionOfPackage("jquery", "3.0", "3.0.9999");

        return expect(getTypingInfo("jquery", dt.fs)).resolves.toBeDefined();
      });
    });
  });

  it("allows wildcard scope path mappings", () => {
    const dt = createMockDT();
    return expect(getTypingInfo("wordpress__plugins", dt.fs)).resolves.toBeDefined();
  });

  it("does not error on allowed dependencies", () => {
    const dt = createMockDT();

    return expect(getTypingInfo("allowed-dep", dt.fs)).resolves.not.toHaveProperty("errors");
  });

  it("errors on non-allowed dependencies", () => {
    const dt = createMockDT();

    return expect(getTypingInfo("non-allowed-dep", dt.fs)).resolves.toEqual({
      errors: [
        "In package.json: Dependency not-allowed not in the allowed dependencies list.\n" +
        "Please make a pull request to microsoft/DefinitelyTyped-tools adding it to `packages/definitions-parser/allowedPackageJsonDependencies.txt`.",
      ],
    });
  });

  it("does not error on allowed peer dependencies", () => {
    const dt = createMockDT();

    return expect(getTypingInfo("allowed-peer-dep", dt.fs)).resolves.not.toHaveProperty("errors");
  });

  it("errors on non-allowed peer dependencies", () => {
    const dt = createMockDT();

    return expect(getTypingInfo("non-allowed-peer-dep", dt.fs)).resolves.toEqual({
      errors: [
        "In package.json: Dependency not-allowed-peer not in the allowed dependencies list.\n" +
        "Please make a pull request to microsoft/DefinitelyTyped-tools adding it to `packages/definitions-parser/allowedPackageJsonDependencies.txt`.",
      ],
    });
  });
});
