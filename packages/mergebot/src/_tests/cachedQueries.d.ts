import * as cachedQueries from "../util/cachedQueries";

type CachedQueries = {
  [key in keyof typeof cachedQueries]: Awaited<ReturnType<(typeof cachedQueries)[key]>>;
};

declare const _default: CachedQueries;
export = cachedQueries;
