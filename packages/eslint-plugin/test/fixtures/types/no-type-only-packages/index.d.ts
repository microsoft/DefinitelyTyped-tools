export interface Blah {
    foo: string;
}

export namespace Something {
    export interface Blah2 {
        foo: string;
    }
}

export type NotAValue = Something.Blah2;
