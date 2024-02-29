import * as good1 from './good1';

export namespace Foo {
    export import C = good1.C;

    const foo: number;
}
