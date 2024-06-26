// In TypeScript <5.5, elem will have type "string",
// but 5.5 it will be "string | number".
const elem = ["value", undefined].filter(x => x != null)[0];


// This should error in 5.4, but not 5.5.
const test1a: string = elem;

// This should error in 5.5, but not 5.4.
const test1b: undefined extends typeof elem ? typeof elem : never = elem;


// None of these expects should error.

// @ts-expect-error <5.5
const test2a: string = elem;

// @ts-expect-error >=5.5
const test2b: undefined extends typeof elem ? typeof elem : never = elem;
