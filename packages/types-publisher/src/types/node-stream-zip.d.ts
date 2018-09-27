export = StreamZip;
declare class StreamZip {
    constructor(options: { file: string });

    on(name: "ready", cb: () => void): void;
    on(name: "error", cb: (err: Error) => void): void;
    extract(pathInZip: string | null | undefined, toPath: string, cb: (err: Error | null | undefined, count: number) => void): void;
    close(): void;
}
