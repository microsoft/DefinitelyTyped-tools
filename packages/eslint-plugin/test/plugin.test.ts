import { describe, it } from "node:test";
import plugin = require("../src/index");

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
});
