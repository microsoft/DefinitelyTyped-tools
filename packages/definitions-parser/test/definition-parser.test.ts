import { createMockDT } from "../src/mocks";
import { getTypingInfo } from "../src/lib/definition-parser";

describe(getTypingInfo, () => {
  it("keys data by major.minor version", async () => {
    const dt = createMockDT();
    dt.addOldVersionOfPackage("jquery", "1.42");
    dt.addOldVersionOfPackage("jquery", "2");
    const info = await getTypingInfo("jquery", dt.pkgFS("jquery"));

    expect(Object.keys(info).sort()).toEqual(["1.42", "2.0", "3.3"]);
  });

  it("works for a package with dependencies", async () => {
    const dt = createMockDT();
    const info = await getTypingInfo("has-dependency", dt.pkgFS("has-dependency"));
    expect(info).toBeDefined();
  });

  it("works for a scoped package with scoped older dependencies", async () => {
    const dt = createMockDT();
    const scopedWithOlderScopedDependency = dt.pkgDir("ckeditor__ckeditor5-engine");
    scopedWithOlderScopedDependency.set(
      "index.d.ts",
      `// Type definitions for @ckeditor/ckeditor-engine 25.0
// Project: https://github.com/ckeditor/ckeditor5/tree/master/packages/ckeditor5-engine
// Definitions by: My Self <https://github.com/ñ>
// Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped

import * as utils from '@ckeditor/ckeditor5-utils';`
    );

    scopedWithOlderScopedDependency.set(
      "tsconfig.json",
      JSON.stringify({
        files: ["index.d.ts"],
        compilerOptions: {
          paths: {
            "@ckeditor/ckeditor5-utils": ["ckeditor__ckeditor5-utils/v10"]
          }
        }
      })
    );

    const olderScopedPackage = dt.pkgDir("ckeditor__ckeditor5-utils");
    olderScopedPackage.set(
      "index.d.ts",
      `// Type definitions for @ckeditor/ckeditor5-utils 25.0
// Project: https://github.com/ckeditor/ckeditor5/tree/master/packages/ckeditor5-utils
// Definitions by: My Self <https://github.com/ñ>
// Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped
export function myFunction(arg:string): string;
 `
    );
    olderScopedPackage.set(
      "tsconfig.json",
      JSON.stringify({
        files: ["index.d.ts"],
        compilerOptions: {
          paths: {}
        }
      })
    );

    dt.addOldVersionOfPackage("@ckeditor/ckeditor5-utils", "10");

    const info = await getTypingInfo("@ckeditor/ckeditor5-engine", dt.pkgFS("ckeditor__ckeditor5-engine"));
    expect(info).toBeDefined();
  });

  it("allows path mapping to older versions", () => {
    // Actually, the default seup already has 'has-older-test-dependency', so probably doesn't need an explicit test
    const dt = createMockDT();
    dt.addOldVersionOfPackage("jquery", "1.42");
    dt.addOldVersionOfPackage("jquery", "2");
    // now add a dependency that maps to jquery/1.42
  });
  it("allows path mapping to node/buffer", async () => {
    // Actually, the default seup already has 'has-older-test-dependency', so probably doesn't need an explicit test
    const dt = createMockDT();
    const safer = dt.pkgDir("safer");
    safer.set(
      "index.d.ts",
      `// Type definitions for safer 1.0
// Project: https://github.com/safer/safer
// Definitions by: Noone <https://github.com/noone>
// Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped

/// <reference types="node" />
export * from 'buffer';
`
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
} `
    );

    const info = await getTypingInfo("safer", dt.pkgFS("safer"));
    expect(info).toBeDefined();
    expect(info["1.0"].dependencies).toEqual({ node: "*" });
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
/* tslint:disable-next-line:no-self-import */
import webpack = require('webpack');
export = webpack;
`
    );
    webpack.set(
      "webpack-tests.ts",
      `
import webpack = require('webpack');
const a = new webpack.AutomaticPrefetchPlugin();
`
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
}`
    );

    const info = await getTypingInfo("webpack", dt.pkgFS("webpack"));
    expect(info).toBeDefined();
  });

  describe("concerning multiple versions", () => {
    it("records what the version directory looks like on disk", async () => {
      const dt = createMockDT();
      dt.addOldVersionOfPackage("jquery", "2");
      dt.addOldVersionOfPackage("jquery", "1.5");
      const info = await getTypingInfo("jquery", dt.pkgFS("jquery"));

      expect(info).toEqual({
        "1.5": expect.objectContaining({
          libraryVersionDirectoryName: "1.5"
        }),
        "2.0": expect.objectContaining({
          libraryVersionDirectoryName: "2"
        }),
        "3.3": expect.objectContaining({
          // The latest version does not have its own version directory
          libraryVersionDirectoryName: undefined
        })
      });
    });

    it("records a path mapping to the version directory", async () => {
      const dt = createMockDT();
      dt.addOldVersionOfPackage("jquery", "2");
      dt.addOldVersionOfPackage("jquery", "1.5");
      const info = await getTypingInfo("jquery", dt.pkgFS("jquery"));

      expect(info).toEqual({
        "1.5": expect.objectContaining({
          pathMappings: {
            jquery: { major: 1, minor: 5 }
          }
        }),
        "2.0": expect.objectContaining({
          pathMappings: {
            jquery: { major: 2, minor: undefined }
          }
        }),
        "3.3": expect.objectContaining({
          // The latest version does not have path mappings of its own
          pathMappings: {}
        })
      });
    });

    it("records a path mapping to the scoped version directory", async () => {
      const dt = createMockDT();
      const pkg = dt.pkgDir("ckeditor__ckeditor5-utils");
      pkg.set(
        "tsconfig.json",
        JSON.stringify({
          files: ["index.d.ts"],
          compilerOptions: {
            paths: {}
          }
        })
      );
      pkg.set(
        "index.d.ts",
        `// Type definitions for @ckeditor/ckeditor-utils 25.0
// Project: https://github.com/ckeditor/ckeditor5/tree/master/packages/ckeditor5-engine
// Definitions by: My Self <https://github.com/ñ>
// Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped
`
      );

      dt.addOldVersionOfPackage("@ckeditor/ckeditor5-utils", "10");

      const info = await getTypingInfo("@ckeditor/ckeditor5-utils", dt.pkgFS("ckeditor__ckeditor5-utils"));
      expect(info).toEqual({
        "10.0": expect.objectContaining({
          pathMappings: {
            "@ckeditor/ckeditor5-utils": { major: 10 }
          }
        }),
        "25.0": expect.objectContaining({
          // The latest version does not have path mappings of its own
          pathMappings: {}
        })
      });
    });

    describe("validation thereof", () => {
      it("throws if a directory exists for the latest major version", () => {
        const dt = createMockDT();
        dt.addOldVersionOfPackage("jquery", "3");

        return expect(getTypingInfo("jquery", dt.pkgFS("jquery"))).rejects.toThrow(
          "The latest version of the 'jquery' package is 3.3, so the subdirectory 'v3' is not allowed; " +
            "since it applies to any 3.* version, up to and including 3.3."
        );
      });

      it("throws if a directory exists for the latest minor version", () => {
        const dt = createMockDT();
        dt.addOldVersionOfPackage("jquery", "3.3");

        return expect(getTypingInfo("jquery", dt.pkgFS("jquery"))).rejects.toThrow(
          "The latest version of the 'jquery' package is 3.3, so the subdirectory 'v3.3' is not allowed."
        );
      });

      it("does not throw when a minor version is older than the latest", () => {
        const dt = createMockDT();
        dt.addOldVersionOfPackage("jquery", "3.0");

        return expect(getTypingInfo("jquery", dt.pkgFS("jquery"))).resolves.toBeDefined();
      });

      it("checks that older versions with non-relative imports have wildcard path mappings", () => {
        const dt = createMockDT();
        const jquery = dt.pkgDir("jquery");
        jquery.set(
          "JQuery.d.ts",
          `import "jquery/component";
`
        );
        dt.addOldVersionOfPackage("jquery", "1");
        return expect(getTypingInfo("jquery", dt.pkgFS("jquery"))).rejects.toThrow(
          'jquery: Older version 1 must have a "paths" entry of "jquery/*": ["jquery/v1/*"]'
        );
      });

      it("checks that scoped older versions with non-relative imports have wildcard path mappings", () => {
        const dt = createMockDT();
        const pkg = dt.pkgDir("ckeditor__ckeditor5-utils");
        pkg.set(
          "index.d.ts",
          `// Type definitions for @ckeditor/ckeditor5-utils 25.0
// Project: https://github.com/ckeditor/ckeditor5/tree/master/packages/ckeditor5-utils
// Definitions by: My Self <https://github.com/ñ>
// Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped
import first from "@ckeditor/ckeditor5-utils/src/first";
 `
        );
        pkg.set(
          "tsconfig.json",
          JSON.stringify({
            files: ["index.d.ts"],
            compilerOptions: {
              paths: {}
            }
          })
        );

        dt.addOldVersionOfPackage("@ckeditor/ckeditor5-utils", "10");

        return expect(
          getTypingInfo("ckeditor__ckeditor5-utils", dt.pkgFS("ckeditor__ckeditor5-utils"))
        ).rejects.toThrow(
          '@ckeditor/ckeditor5-utils: Older version 10 must have a "paths" entry of "@ckeditor/ckeditor5-utils/*": ["ckeditor__ckeditor5-utils/v10/*"]'
        );
      });
    });
  });

  it("allows wildcard scope path mappings", () => {
    const dt = createMockDT();
    return expect(getTypingInfo("wordpress__plugins", dt.pkgFS("wordpress__plugins"))).resolves.toBeDefined();
  });
});
