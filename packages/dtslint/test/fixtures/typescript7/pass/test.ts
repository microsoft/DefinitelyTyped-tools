import { literal } from "./index";
import type { ExternalType } from "../external";

// $ExpectType 1
literal();

declare const external: ExternalType;
external;

declare const object: { b: string; a: number };
object; // $ExpectType { a: number; b: string; }
