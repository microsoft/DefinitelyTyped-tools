export const foo = 1234;

export const aUnion: string | number | undefined;

export function complicatedUnion<T extends string | number>(x: T, y: T): {
    prop1: "a" | "b" | "c";
    prop2: readonly (string | number)[];
    prop3: ReadonlyArray<string | number>;
};
