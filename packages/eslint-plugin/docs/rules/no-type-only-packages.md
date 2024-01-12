# no-type-only-packages

If there's no source JavaScript code at all, for example if you're writing helper types or types for a spec, you should publish the types yourself, not on Definitely Typed.
Because they're meant to provide types for existing JavaScript code, `@types` packages are not meant to be imported directly.
That is, you shouldn't create a Definitely Typed package that's meant to be used like `import type { ... } from "@types/foo"`.
Nor should you expect to write `import type { ... } from "foo"` when there's no `foo` installed.

**Bad**:

```ts
export interface SomeInterface {
    someProperty: string;
}
```

**Good**:

```ts
export interface SomeInterface {
    someProperty: string;
}

export function someLibraryFunction(): SomeInterface;
```
