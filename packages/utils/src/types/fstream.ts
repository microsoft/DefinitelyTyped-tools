declare module "fstream" {
  // tslint:disable-next-line:function-name
  export function Reader(options: ReaderOptions): NodeJS.ReadableStream;
  interface ReaderOptions {
    path: string;
    type: "Directory";
    filter(entry: FStreamEntry): boolean;
  }
  interface FStreamEntry {
    props: { type: string; mode: number };
  }
}
