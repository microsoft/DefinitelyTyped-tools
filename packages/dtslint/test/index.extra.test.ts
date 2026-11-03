/// <reference types="jest" />
import { assertPackageIsNotDeprecated } from "../src/index";

describe("assertPackageIsNotDeprecated extended", () => {
  it("throws with informative message including package name", () => {
    expect(() => assertPackageIsNotDeprecated("moment", '{ "packages": { "moment": {} } }')).toThrow(
      "notNeededPackages.json has an entry for moment",
    );
  });

  it("does not throw when notNeededPackages has other packages", () => {
    expect(assertPackageIsNotDeprecated("lodash", '{ "packages": { "moment": {} } }')).toBeUndefined();
  });

  it("does not throw when packages object is empty", () => {
    expect(assertPackageIsNotDeprecated("anything", '{ "packages": {} }')).toBeUndefined();
  });

  it("handles multiple packages in the list", () => {
    const json = '{ "packages": { "foo": {}, "bar": {}, "baz": {} } }';
    expect(() => assertPackageIsNotDeprecated("bar", json)).toThrow("notNeededPackages.json has an entry for bar");
    expect(assertPackageIsNotDeprecated("qux", json)).toBeUndefined();
  });

  it("throw message mentions removing entry from notNeededPackages.json", () => {
    expect(() => assertPackageIsNotDeprecated("test-pkg", '{ "packages": { "test-pkg": {} } }')).toThrow(
      /remove its entry from notNeededPackages\.json/,
    );
  });
});
