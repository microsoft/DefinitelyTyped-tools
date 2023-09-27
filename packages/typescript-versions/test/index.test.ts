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
    expect(TypeScriptVersion.isSupported("4.5")).toBeTruthy();
  });
  it("supports 4.3", () => {
    expect(TypeScriptVersion.isSupported("4.3")).toBeTruthy();
  });
  it("does not support 4.2", () => {
    expect(!TypeScriptVersion.isSupported("4.2")).toBeTruthy();
  });
});

describe("isTypeScriptVersion", () => {
  it("accepts in-range", () => {
    expect(TypeScriptVersion.isTypeScriptVersion("4.5")).toBeTruthy();
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
    expect(TypeScriptVersion.range("4.7")).toEqual(["4.7", "4.8", "4.9", "5.0", "5.1"]);
  });
  it("includes 4.3 onwards", () => {
    expect(TypeScriptVersion.range("4.3")).toEqual(TypeScriptVersion.supported);
  });
});

describe("tagsToUpdate", () => {
  it("works", () => {
    expect(TypeScriptVersion.tagsToUpdate("5.0")).toEqual(["ts5.0", "ts5.1", "latest"]);
  });
  it("allows 4.2 onwards", () => {
    expect(TypeScriptVersion.tagsToUpdate("4.3")).toEqual(
      TypeScriptVersion.supported.map((s) => "ts" + s).concat("latest")
    );
  });
});

