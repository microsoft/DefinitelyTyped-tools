import plugin = require("../src/index");

describe("plugin", () => {
  it("should have the expected exports", () => {
    expect({
      ...plugin,
      meta: {
        ...plugin.meta,
        version: "version",
      },
      rules: Object.keys(plugin.rules),
    }).toMatchSnapshot();
  });
});
