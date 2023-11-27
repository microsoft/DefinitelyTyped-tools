// TODO(jakebailey): dedupe with typescript-versions; but that doesn't specify "next"
export const versions: readonly string[] = ["4.5", "4.6", "4.7", "4.8", "4.9", "5.0", "5.1", "5.2", "5.3", "next"];

export function resolve(version: string) {
  return require.resolve(`typescript-${version}`);
}
