export const canHandleRequest = (event: string, action: string) =>
  event === "discussion" && (action === "created" || action === "edited");

// npm package name grammar (post-2017): optional `@scope/`, lowercase, limited punctuation.
// Used to validate the substring extracted from an untrusted discussion title before it is fed
// into bot comments or used to create repository labels via GraphQL.
const npmPackageNameRegex = /^(?:@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/;

export function extractNPMReference(discussion: { title: string }) {
  const title = discussion.title;
  if (title.includes("[") && title.includes("]")) {
    const full = title.split("[")[1]!.split("]")[0]!;
    const name = full.replace("@types/", "");
    if (!npmPackageNameRegex.test(name)) return undefined;
    return name;
  }
  return undefined;
}
