import { checkPathMappings } from "../src/check-parse-results";
import { AllPackages } from "@definitelytyped/definitions-parser";

// based on ember's structure, but corrected
const transitivePathMappingDependencies = AllPackages.from(
  {
    application: {
      "1.0": {
        typingsPackageName: "application",
        dependencies: { engine: "*", object: "*", routing: "*" },
        testDependencies: [],
        pathMappings: {
          engine: { major: 1 },
          object: { major: 1 },
          routing: { major: 1 },
          controller: { major: 1 },
          service: { major: 1 },
        },
      },
    },
    controller: {
      "1.0": { typingsPackageName: "controller", dependencies: {}, testDependencies: [], pathMappings: {} },
    },
    engine: {
      "1.0": { typingsPackageName: "engine", dependencies: {}, testDependencies: [], pathMappings: {} },
    },
    error: {
      "1.0": { typingsPackageName: "error", dependencies: {}, testDependencies: [], pathMappings: {} },
    },
    object: {
      "1.0": { typingsPackageName: "object", dependencies: {}, testDependencies: [], pathMappings: {} },
    },
    routing: {
      "1.0": {
        typingsPackageName: "routing",
        dependencies: { controller: "*", service: "*" },
        testDependencies: [],
        pathMappings: {
          controller: { major: 1 },
          service: { major: 1 },
        },
      },
    },
    service: {
      "1.0": { typingsPackageName: "service", dependencies: {}, testDependencies: [], pathMappings: {} },
    },
    "test-helper": {
      "1.0": {
        typingsPackageName: "test-helper",
        dependencies: { application: "*", error: "*" },
        testDependencies: [],
        pathMappings: {
          application: { major: 1 },
          engine: { major: 1 },
          object: { major: 1 },
          routing: { major: 1 },
          controller: { major: 1 },
          service: { major: 1 },
          error: { major: 1 },
        },
      },
    },
  } as never,
  []
);
// test-helper depends on application, which is missing transitive mappings for controller and service
const missingTransitivePathMappingDependencies = AllPackages.from(
  {
    application: {
      "1.0": {
        typingsPackageName: "application",
        dependencies: { engine: "*", object: "*", routing: "*" },
        testDependencies: [],
        pathMappings: {
          engine: { major: 1 },
          object: { major: 1 },
          routing: { major: 1 },
        },
      },
    },
    controller: {
      "1.0": { typingsPackageName: "controller", dependencies: {}, testDependencies: [], pathMappings: {} },
    },
    engine: {
      "1.0": { typingsPackageName: "engine", dependencies: {}, testDependencies: [], pathMappings: {} },
    },
    error: {
      "1.0": { typingsPackageName: "error", dependencies: {}, testDependencies: [], pathMappings: {} },
    },
    object: {
      "1.0": { typingsPackageName: "object", dependencies: {}, testDependencies: [], pathMappings: {} },
    },
    routing: {
      "1.0": {
        typingsPackageName: "routing",
        dependencies: { controller: "*", service: "*" },
        testDependencies: [],
        pathMappings: {
          controller: { major: 1 },
          service: { major: 1 },
        },
      },
    },
    service: {
      "1.0": { typingsPackageName: "service", dependencies: {}, testDependencies: [], pathMappings: {} },
    },
    "test-helper": {
      "1.0": {
        typingsPackageName: "test-helper",
        dependencies: { application: "*", error: "*" },
        testDependencies: [],
        pathMappings: {
          application: { major: 1 },
          engine: { major: 1 },
          object: { major: 1 },
          routing: { major: 1 },
          controller: { major: 1 },
          service: { major: 1 },
          error: { major: 1 },
        },
      },
    },
  } as never,
  []
);

test("Transitive path mapping dependencies", () => {
  expect(checkPathMappings(transitivePathMappingDependencies)).toBeUndefined();
});

test("Missing transitive path mapping dependencies", () => {
  expect(() => checkPathMappings(missingTransitivePathMappingDependencies)).toThrow(
    `test-helper has unused path mappings for [controller, service].
If these mappings are actually used, they could be missing in a dependency's tsconfig.json instead.
Check the path mappings for [application, error].`
  );
});
