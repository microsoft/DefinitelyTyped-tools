interface Exports {
  (): void;
  foo: () => {};
}

declare const exp: Exports;
export = exp;
