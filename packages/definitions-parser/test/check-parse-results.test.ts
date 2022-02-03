import { checkPathMappings } from "../src/check-parse-results";
import { TypesDataFile, AllPackages, DirectoryParsedTypingVersion } from "../src/packages";
import { testo, createTypingsVersionRaw } from "./utils";

/** make a list of mappings, all to version 1 since these tests don't care */
function makeMappings(...names: string[]) {
  const o = {} as Record<string, DirectoryParsedTypingVersion>;
  for (const name of names) {
    o[name] = { major: 1 };
  }
  return o;
}
testo({
  transitivePathMappingDependencies() {
    // based on ember's structure, but corrected
    const typesData: TypesDataFile = {
      application: createTypingsVersionRaw(
        "application",
        { engine: "*", object: "*", routing: "*" },
        [],
        makeMappings("engine", "object", "routing", "controller", "service")
      ),
      controller: createTypingsVersionRaw("controller", {}, [], {}),
      engine: createTypingsVersionRaw("engine", {}, [], {}),
      error: createTypingsVersionRaw("error", {}, [], {}),
      object: createTypingsVersionRaw("object", {}, [], {}),
      routing: createTypingsVersionRaw(
        "routing",
        { controller: "*", service: "*" },
        [],
        makeMappings("controller", "service")
      ),
      service: createTypingsVersionRaw("service", {}, [], {}),
      "test-helper": createTypingsVersionRaw(
        "test-helper",
        { application: "*", error: "*" },
        [],
        makeMappings("application", "engine", "object", "routing", "controller", "service", "error")
      )
    };
    expect(checkPathMappings(AllPackages.from(typesData, []))).toBeUndefined();
  },
  /**
   * test-helper depends on application, which is missing transitive mappings for
   * controller and service
   */
  missingTransitivePathMappingDependencies() {
    const typesData: TypesDataFile = {
      application: createTypingsVersionRaw(
        "application",
        { engine: "*", object: "*", routing: "*" },
        [],
        makeMappings("engine", "object", "routing")
      ),
      controller: createTypingsVersionRaw("controller", {}, [], {}),
      engine: createTypingsVersionRaw("engine", {}, [], {}),
      error: createTypingsVersionRaw("error", {}, [], {}),
      object: createTypingsVersionRaw("object", {}, [], {}),
      routing: createTypingsVersionRaw(
        "routing",
        { controller: "*", service: "*" },
        [],
        makeMappings("controller", "service")
      ),
      service: createTypingsVersionRaw("service", {}, [], {}),
      "test-helper": createTypingsVersionRaw(
        "test-helper",
        { application: "*", error: "*" },
        [],
        makeMappings("application", "engine", "object", "routing", "controller", "service", "error")
      )
    };
    expect(() => checkPathMappings(AllPackages.from(typesData, []))).toThrow(
      `test-helper has unused path mappings for [controller, service].
If these mappings are actually used, they could be missing in a dependency's tsconfig.json instead.
Check the path mappings for [application, error].`
    );
  }
});
