import { literal } from "./index";
import type { ExternalType } from "../external";

// $ExpectType 1
literal();

declare const external: ExternalType;
external;

declare const object: { b: string; a: number };
object; // $ExpectType { a: number; b: string; }

declare const overloaded: {
  (value: string): string;
  (value: number): number;
};
// $ExpectType { (value: string): string; (value: number): number; } || { (value: number): number; (value: string): string; }
overloaded;

// @ts-expect-error >=7.0
const expectedError: string = 1;

// @ts-expect-error <7.0
const noErrorOutsideRange: string = "";
