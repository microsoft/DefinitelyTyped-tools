import parseDefinitions from "./parse-definitions";
import { getDefinitelyTyped } from "./get-definitely-typed";
import { Options } from "./lib/common";
import { loggerWithErrors } from "./util/logging";

function testo(o: { [s: string]: () => void }) {
    for (const k in o) {
        test(k, o[k], 100_000);
    }
}
testo({
    async parseDefinitions() {
        const log = loggerWithErrors()[0]
        // TODO: A mocked DT would be really nice here
        const dt = await getDefinitelyTyped(Options.defaults, log);
        const defs = await parseDefinitions(dt, undefined, log)
        expect(defs.allNotNeeded().length).toBeGreaterThan(0)
        expect(defs.allTypings().length).toBeGreaterThan(5000)
        const j = defs.tryGetLatestVersion("jquery")
        expect(j).toBeDefined()
        expect(j!.fullNpmName).toContain("types")
        expect(j!.fullNpmName).toContain("jquery")
        expect(defs.allPackages().length).toEqual(defs.allTypings().length + defs.allNotNeeded().length)
    },
});
