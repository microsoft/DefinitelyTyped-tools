import { ESLintUtils } from "@typescript-eslint/utils";

import * as dtHeader from "../src/rules/dt-header";

const ruleTester = new ESLintUtils.RuleTester({
  parser: "@typescript-eslint/parser",
});

ruleTester.run("dt-header", dtHeader, {
  invalid: [
    {
      code: ``,
      errors: [
        {
          column: 2,
          data: {
            expected: "/\\/\\/ Type definitions for (non-npm package )?/",
          },
          line: 1,
          messageId: "parseError",
        },
      ],
      filename: "types/blank/index.d.ts",
    },
    {
      code: `
      // ...
      `,
      errors: [
        {
          column: 2,
          data: {
            expected: "/\\/\\/ Type definitions for (non-npm package )?/",
          },
          line: 1,
          messageId: "parseError",
        },
      ],
      filename: "types/only-comment/index.d.ts",
    },
    {
      code: `// Type definitions for dt-header 1.0
// Project: https://github.com/bobby-headers/dt-header
// Definitions by: Jane Doe <https://github.ORG/janedoe>
// Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped
`,
      errors: [
        {
          column: 30,
          data: {
            expected: "/\\<https\\:\\/\\/github\\.com\\/([a-zA-Z\\d\\-]+)\\/?\\>/",
          },
          line: 3,
          messageId: "parseError",
        },
      ],
      filename: "types/bad-url-github-org/index.d.ts",
    },
    {
      code: `// Type definitions for dt-header 1.0
// Project: https://github.com/bobby-headers/dt-header
// Definitions by: Jane Doe <https://github.com/jane doe>
// Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped
`,
      errors: [
        {
          column: 30,
          data: {
            expected: "/\\<https\\:\\/\\/github\\.com\\/([a-zA-Z\\d\\-]+)\\/?\\>/",
          },
          line: 3,
          messageId: "parseError",
        },
      ],
      filename: "types/bad-url-space/index.d.ts",
    },
    {
      code: `// Type definitions for dt-header 1.0
// Project: https://github.com/not/important
// Definitions by: My Self <https://github.com/me>
// Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped
      
`,
      errors: [
        {
          column: 1,
          endColumn: 27,
          line: 3,
          messageId: "definitionsBy",
        },
      ],
      filename: "types/bad-username/index.d.ts",
    },
    {
      code: `// Type definitions for dt-header v1.0.3
// Project: https://github.com/bobby-headers/dt-header
// Definitions by: Jane Doe <https://github.com/janedoe>
// Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped
`,
      errors: [
        {
          column: 26,
          data: {
            expected: "foo MAJOR.MINOR (patch version not allowed)",
          },
          line: 1,
          messageId: "parseError",
        },
      ],
      filename: "types/foo/index.d.ts",
    },
    {
      code: `// Type definitions for
`,
      errors: [
        {
          column: 1,
          endColumn: 24,
          line: 1,
          messageId: "typeDefinitionsFor",
        },
      ],
      filename: "types/foo/notIndex.d.ts",
    },
  ],
  valid: [
    ``,
    {
      code: `// This isn't the main index
`,
      filename: "types/foo/bar/index.d.ts",
    },
    {
      code: `// Type definitions for dt-header 0.75
// Project: https://github.com/bobby-headers/dt-header
// Definitions by: Jane Doe <https://github.com/janedoe>
// Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped
// Minimum TypeScript Version: 3.1
      
`,
      filename: "types/foo/v0.75/index.d.ts",
    },
    {
      code: `// Type definitions for dt-header 1.0
// Project: https://github.com/bobby-headers/dt-header
// Definitions by: Jane Doe <https://github.com/janedoe>
// Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped
// Minimum TypeScript Version: 3.1
      
`,
      filename: "types/foo/v1/index.d.ts",
    },
    {
      code: `// Type definitions for dt-header 2.0
// Project: https://github.com/bobby-headers/dt-header
// Definitions by: Jane Doe <https://github.com/janedoe>
// Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped
// Minimum TypeScript Version: 3.1
      
`,
      filename: "types/foo/index.d.ts",
    },
    {
      code: ``,
      filename: "types/foo/notIndex.d.ts",
    },
  ],
});
