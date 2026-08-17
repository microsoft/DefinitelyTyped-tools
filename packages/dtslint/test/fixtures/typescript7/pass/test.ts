import { literal } from "./index";
import type { ExternalType } from "../external";

// $ExpectType 1
literal();

declare const external: ExternalType;
external;
