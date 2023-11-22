// eslint-disable-next-line @definitelytyped/no-relative-import-in-test
import * as expect from "./";


// $ExpectType number
expect.foo;


// $ExpectType 1234
expect.foo;


// $ExpectType NotRightAtAll
expect.foo;


// $ExpectType Oops
