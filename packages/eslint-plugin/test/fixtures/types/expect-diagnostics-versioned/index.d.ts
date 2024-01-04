export const foo = 1234;

// This should cause a diagnostic.
export const badSet: Array<string, number, number, number>;
