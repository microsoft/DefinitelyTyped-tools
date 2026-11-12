import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ESLint } from "eslint";
import plugin = require("../index");

describe("plugin", () => {
  it("should have the expected exports", (t) => {
    t.assert.snapshot({
      ...plugin,
      meta: {
        ...plugin.meta,
        version: "version",
      },
      rules: Object.keys(plugin.rules),
    });
  });

  describe("JSDoc configuration", () => {
    const eslint = new ESLint({
      useEslintrc: false,
      overrideConfig: {
        plugins: ["jsdoc"],
        settings: plugin.configs.all.settings,
        rules: plugin.configs.all.rules,
      },
    });

    it("accepts established inline tags and type parameters", async () => {
      const [result] = await eslint.lintText(`
    /**
     * {@code example} {@see example} {@type string} {@link example}
     * @typeParam T - Type parameter.
     * @privateRemarks Additional documentation.
     */
    function example(value) { return value; }
    `);
      assert.deepEqual(result.messages, []);
    });

    it("rejects unknown block and inline tags", async () => {
      const [result] = await eslint.lintText(`
    /**
     * {@definitelyInvalidTag example}
     * @definitelyInvalidTag
     */
    function example(value) { return value; }
    `);
      assert.equal(result.errorCount, 2);
      assert.ok(result.messages.every((message) => message.ruleId === "jsdoc/check-tag-names"));
    });
  });
});
