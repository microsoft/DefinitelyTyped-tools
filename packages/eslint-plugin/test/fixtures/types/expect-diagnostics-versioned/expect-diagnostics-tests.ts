// eslint-disable-next-line @definitelytyped/no-relative-import-in-test
import * as expect from ".";

// This should cause a diagnostic.
const blah: string = expect.foo;
