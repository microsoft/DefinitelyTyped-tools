declare function _default(): void;

declare namespace _default {
  export function findDtsName(dtsPath: string): string;
  export function checkNames(names: string[]): unknown;
  export function checkSource(text: string): unknown;
  export function findNames(): string[];
  export function retrieveNpmHomepageOrFail(): string[];
}
