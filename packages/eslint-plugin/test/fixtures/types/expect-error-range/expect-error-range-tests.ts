// In TypeScript <5.5, elem will have type "string",
// but 5.5 it will be "string | undefined".
const elem = ["value", undefined].filter(x => x != null)[0];


{
    // This should error in 5.4, but not 5.5.
    const test1: string = elem;

    // This should error in 5.5, but not 5.4.
    const test2: undefined extends typeof elem ? typeof elem : never = elem;
}

{
    // This should error in 5.5, but not 5.4.
    // @ts-expect-error
    const test1: string = elem;

    // This should error in 5.4, but not 5.5.
    // @ts-expect-error
    const test2: undefined extends typeof elem ? typeof elem : never = elem;
}

// These should be treated as though there is no range.
{
    // This should error in 5.5, but not 5.4.
    // @ts-expect-error random non-range text
    const test1: string = elem;

    // This should error in 5.4, but not 5.5.
    // @ts-expect-error random non-range text
    const test2: undefined extends typeof elem ? typeof elem : never = elem;
}

// None of these expects should error.
{
    // @ts-expect-error <5.5
    const test1: string = elem;

    // @ts-expect-error >=5.5
    const test2: undefined extends typeof elem ? typeof elem : never = elem;
}

