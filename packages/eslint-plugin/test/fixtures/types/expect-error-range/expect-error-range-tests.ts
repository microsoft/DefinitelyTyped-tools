const elem = ["value", undefined].filter(x => x != null)[0];
declare const test: typeof elem & undefined


// These should give expect errors:

const isStringNoIgnore: string = elem;

test?.trim();



// These should give expect these should not:


// @ts-expect-error <5.5
const isStringIgnore: string = elem;


// @ts-expect-error >=5.5
test?.trim();
