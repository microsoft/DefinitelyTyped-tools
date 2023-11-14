const f1 = <T>(): T => {};
class C {
    constructor<T>(x: T) {}
}
function f2<T>(): T { }
function f3<T>(x: { T: number }): void;
function f4<T, U extends T>(u: U): U;
const f5 = function<T>(): T {};
interface I {
    <T>(value: T): void;
}
interface I {
    m<T>(x: T): void;
}
