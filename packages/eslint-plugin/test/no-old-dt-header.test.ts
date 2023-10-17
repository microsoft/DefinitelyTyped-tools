import { ESLintUtils } from "@typescript-eslint/utils";

import * as noOldDtHeader from "../src/rules/no-old-dt-header";

const ruleTester = new ESLintUtils.RuleTester({
  parser: "@typescript-eslint/parser",
});

ruleTester.run("@definitelytyped/no-old-dt-header", noOldDtHeader, {
  invalid: [
    {
      code: `// Type definitions for AFRAME 1.2
// Project: https://aframe.io/
// Definitions by: Paul Shannon <https://github.com/devpaul>
//                 Roberto Ritger <https://github.com/bertoritger>
//                 Trygve Wastvedt <https://github.com/twastvedt>
// Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped
// TypeScript Version: 4.4

/**
 * Extended tests and examples available at https://github.com/devpaul/aframe-experiments.git
 */

import * as anime from "animejs";
import * as three from "three";`,
      errors: [
        {
          column: 1,
          endColumn: 25,
          line: 1,
          messageId: "noOldDTHeader",
        },
      ],
      filename: "index.d.ts",
    },
    {
      code: `// Type definitions for AFRAME 1.2
// Definitions by: Paul Shannon <https://github.com/devpaul>`,
      errors: [
        {
          column: 1,
          endColumn: 25,
          line: 1,
          messageId: "noOldDTHeader",
        },
      ],
      filename: "types.d.ts",
    },
  ],
  valid: [
    {
      code: `// Type definitions for AFRAME 1.2
// Definitions by: Paul Shannon <https://github.com/devpaul>`,
      filename: "test.ts",
    },
    {
      code: `// Type definitions for AFRAME 1.2`,
      filename: "types.d.ts",
    },
    {
      code: `// Definitions by: Paul Shannon <https://github.com/devpaul>`,
      filename: "types.d.ts",
    },
    {
      code: `// A line before the old header
      // Type definitions for AFRAME 1.2
// Definitions by: Paul Shannon <https://github.com/devpaul>`,
      filename: "types.d.ts",
    },
  ],
});
