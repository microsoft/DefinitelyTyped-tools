import { Semver } from "./versions";

describe(Semver, () => {
    it("returns a formatted description", () => {
        expect(new Semver(1, 2, 3).versionString).toEqual("1.2.3");
    });

    it("parses semver versions", () => {
        expect(Semver.parse("0.42.1").versionString).toEqual("0.42.1");
    });

    it("parses versions that do not strictly adhere to semver", () => {
        expect(Semver.parse("1", true).versionString).toEqual("1.0.0");
        expect(Semver.parse("0.42", true).versionString).toEqual("0.42.0");
    });

    it("throws when a version cannot be parsed", () => {
        expect(() => Semver.parse("1")).toThrow();
        expect(() => Semver.parse("1", false)).toThrow();
    });

    it("returns whether or not it's equal to another Semver", () => {
        expect(Semver.parse("1.2.3").equals(new Semver(1, 2, 3))).toBe(true);
        expect(Semver.parse("1.2.3").equals(new Semver(3, 2, 1))).toBe(false);
    });

    it("returns whether or not it's greater than another Semver", () => {
        expect(Semver.parse("1.2.3").greaterThan(new Semver(1, 2, 2))).toBe(true);
        expect(Semver.parse("1.2.3").equals(new Semver(1, 2, 4))).toBe(false);
    });
});
