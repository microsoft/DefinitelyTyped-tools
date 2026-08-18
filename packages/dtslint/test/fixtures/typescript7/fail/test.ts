import { literal } from "./index";

// $ExpectType 2
literal();

const bad: string = 1;

declare const overloaded: {
  (value: string): string;
  (value: number): number;
};
// $ExpectType { (value: number): number; (value: string): string; }
overloaded;

declare const overloadedMethod: {
  method(value: string): string;
  method(value: number): number;
};
// $ExpectType { method(value: number): number; method(value: string): string; }
overloadedMethod;
