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
    expect(TypeScriptVersion.isSupported("5.6")).toBeTruthy();
  });
  it("supports 5.1", () => {
    expect(TypeScriptVersion.isSupported("5.1")).toBeTruthy();
  });
  it("does not support 4.0", () => {
    expect(!TypeScriptVersion.isSupported("4.0")).toBeTruthy();
  });
});

describe("isTypeScriptVersion", () => {
  it("accepts in-range", () => {
    expect(TypeScriptVersion.isTypeScriptVersion("5.1")).toBeTruthy();
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
    expect(TypeScriptVersion.range("5.2")).toEqual(["5.2", "5.3", "5.4", "5.5", "5.6", "5.7", "5.8", "5.9"]);
  });
  it("includes 5.1 onwards", () => {
    expect(TypeScriptVersion.range("5.1")).toEqual(TypeScriptVersion.supported);
  });
});

describe("tagsToUpdate", () => {
  it("works", () => {
    expect(TypeScriptVersion.tagsToUpdate("5.2")).toEqual([
      "ts5.2",
      "ts5.3",
      "ts5.4",
      "ts5.5",
      "ts5.6",
      "ts5.7",
      "ts5.8",
      "ts5.9",
      "latest",
    ]);
  });
  it("allows 5.1 onwards", () => {
    expect(TypeScriptVersion.tagsToUpdate("5.1")).toEqual(
      TypeScriptVersion.supported.map((s) => "ts" + s).concat("latest"),
    );
  });
});
