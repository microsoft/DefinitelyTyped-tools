import 'node';

declare global {
  namespace NodeJS {
      interface WriteStream {
          clearLine?(): void;
          cursorTo?(pos: number): void;
      }
  }
}
