declare function example1(a: string): string;
declare function example2<T>(a: T): T;
declare function example3<T>(a: T[]): T;
declare function example4<T>(a: Set<T>): T;
declare function example5<T>(a: Set<T>, b: T[]): void;
declare function example6<T>(a: Map<T, T>): void;
declare function example7<T, U extends T>(t: T, u: U): U;
