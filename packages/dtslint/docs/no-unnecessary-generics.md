# no-unnecessary-generics

Forbids a function to use a generic type parameter only once.
Generic type parameters allow you to relate the type of one thing to another;
if they are used only once, they can be replaced with their type constraint.

**Bad**:

```ts
function logAnything<T>(x: T): void;
```

**Good**:

```ts
function logAnything(x: any): void;
```

---

**Bad**:

```ts
function useLogger<T extends Logger>(logger: T): void;
```

**Good**:

```ts
function useLogger(logger: Logger): void;
```

---

**Bad**:

```ts
function clear<T>(array: T[]): void;
```

**Good**:

```ts
function clear(array: any[]): void;
```

---

**Bad**:

```ts
function parse<T>(): T;
const x = parse<number>();
```

**Good**:


```ts
function parse(): {};
const x = parse() as number;
```
