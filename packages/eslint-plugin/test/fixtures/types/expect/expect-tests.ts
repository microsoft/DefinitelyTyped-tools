// eslint-disable-next-line @definitelytyped/no-relative-import-in-test
import * as expect from "./";


// $ExpectType number
expect.foo;


// $ExpectType 1234
expect.foo;

//    $ExpectType     1234   
expect.foo;

//$ExpectType     1234   
expect.foo;

expect.foo; // $ExpectType 1234

const foo = expect.foo;
foo; // $ExpectType 1234

// $ExpectType NotRightAtAll
expect.foo;

expect.foo; // $ExpectType NotRightAtAll

foo; // $ExpectType NotRightAtAll

// These should not be matched.
// // $ExpectType NotRightAtAll
expect.foo;

expect.foo; // // $ExpectType NotRightAtAll

expect.foo; /// $ExpectType NotRightAtAll


// $ExpectType string | number | undefined
expect.aUnion;

// $ExpectType string | undefined | number
expect.aUnion;

// $ExpectType number | string | undefined
expect.aUnion;

// $ExpectType number | undefined | string
expect.aUnion;

// $ExpectType undefined | string | number
expect.aUnion;

// $ExpectType undefined | number | string
expect.aUnion;

// $ExpectType any || undefined | number | string
expect.aUnion;

// $ExpectType { prop1: "a" | "b" | "c"; prop2: readonly (string | number)[]; prop3: readonly (string | number)[]; }
expect.complicatedUnion(1, 2);

// $ExpectType { prop1: "c" | "b" | "a"; prop2: ReadonlyArray<number | string>; prop3: ReadonlyArray<string | number>; }
expect.complicatedUnion(1, 2);


// $ExpectType NotMatched
// Whoops


// $ExpectType NotMatched
