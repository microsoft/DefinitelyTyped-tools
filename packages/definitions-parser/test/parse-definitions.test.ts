import { createMockDT } from "../src/mocks";
import { parseDefinitions } from "../src/parse-definitions";
import { quietLoggerWithErrors } from "@definitelytyped/utils";
import { testo } from "./utils";

testo({
  // async parseDefinitions() {
  //     const log = loggerWithErrors()[0]
  //     const dt = await getDefinitelyTyped(Options.defaults, log);
  //     const defs = await parseDefinitions(dt, undefined, log)
  //     expect(defs.allNotNeeded().length).toBeGreaterThan(0)
  //     expect(defs.allTypings().length).toBeGreaterThan(5000)
  //     const j = defs.tryGetLatestVersion("jquery")
  //     expect(j).toBeDefined()
  //     expect(j!.fullNpmName).toContain("types")
  //     expect(j!.fullNpmName).toContain("jquery")
  //     expect(defs.allPackages().length).toEqual(defs.allTypings().length + defs.allNotNeeded().length)
  // },
  async mockParse() {
    const log = quietLoggerWithErrors()[0];
    const defs = await parseDefinitions(createMockDT().fs, undefined, log);
    expect(defs.allNotNeeded().length).toBe(1);
    expect(defs.allTypings().length).toBe(6);
    const j = defs.tryGetLatestVersion("jquery");
    expect(j).toBeDefined();
    expect(j!.name).toContain("types");
    expect(j!.name).toContain("jquery");
    expect(defs.allPackages().length).toEqual(defs.allTypings().length + defs.allNotNeeded().length);
  },
});
