import { TypeScriptVersion } from "../src";

describe("unsupported", () => {
  it("contains at least 2.9", () => {
    expect(TypeScriptVersion.unsupported.includes("2.9")).toBeTruthy();
  });
});

describe("all", () => {
  it("doesn't have any holes", () => {
    let prev = TypeScriptVersion.all[0];
    for (const version of TypeScriptVersion.all.slice(1)) {
      expect(+version * 10 - +prev * 10).toEqual(1);
      prev = version;
    }
  });
});

describe("isSupported", () => {
  it("works", () => {
    expect(TypeScriptVersion.isSupported("5.1")).toBeTruthy();
  });
  it("supports 4.6", () => {
    expect(TypeScriptVersion.isSupported("4.6")).toBeTruthy();
  });
  it("does not support 4.5", () => {
    expect(!TypeScriptVersion.isSupported("4.5")).toBeTruthy();
  });
});

describe("isTypeScriptVersion", () => {
  it("accepts in-range", () => {
    expect(TypeScriptVersion.isTypeScriptVersion("5.0")).toBeTruthy();
  });
  it("rejects out-of-range", () => {
    expect(TypeScriptVersion.isTypeScriptVersion("101.1")).toBeFalsy();
  });
  it("rejects garbage", () => {
    expect(TypeScriptVersion.isTypeScriptVersion("it'sa me, luigi")).toBeFalsy();
  });
});

describe("range", () => {
  it("works", () => {
    expect(TypeScriptVersion.range("4.9")).toEqual(["4.9", "5.0", "5.1", "5.2", "5.3", "5.4"]);
  });
  it("includes 4.6 onwards", () => {
    expect(TypeScriptVersion.range("4.6")).toEqual(TypeScriptVersion.supported);
  });
});

describe("tagsToUpdate", () => {
  it("works", () => {
    expect(TypeScriptVersion.tagsToUpdate("5.0")).toEqual(["ts5.0", "ts5.1", "ts5.2", "ts5.3", "ts5.4", "latest"]);
  });
  it("allows 4.6 onwards", () => {
    expect(TypeScriptVersion.tagsToUpdate("4.6")).toEqual(
      TypeScriptVersion.supported.map((s) => "ts" + s).concat("latest"),
    );
  });
});
