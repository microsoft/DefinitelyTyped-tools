import plugin = require("../src/index");

describe("plugin", () => {
  it("should have the expected exports", () => {
    expect(plugin).toMatchSnapshot();
  });
});
