import { typeScriptPath } from "../src/typescript-installer";
import { TypeScriptVersion } from "@definitelytyped/typescript-versions";
import * as os from "os";
import * as path from "path";

describe("typeScriptPath", () => {
  it("maps to temp folder", () => {
    expect(typeScriptPath("5.3", undefined)).toEqual(
      path.join(os.homedir(), ".dts", "typescript-installs", "5.3", "node_modules", "typescript"),
    );
  });
  it("maps next to latest typescript version", () => {
    expect(typeScriptPath("next", undefined)).toEqual(
      path.join(os.homedir(), ".dts", "typescript-installs", TypeScriptVersion.latest, "node_modules", "typescript"),
    );
  });
});
