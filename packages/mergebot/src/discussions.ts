export const canHandleRequest = (event: string, action: string) =>
  event === "discussion" && (action === "created" || action === "edited");

export function extractNPMReference(discussion: { title: string }) {
  const title = discussion.title;
  if (title.includes("[") && title.includes("]")) {
    const full = title.split("[")[1]!.split("]")[0];
    return full!.replace("@types/", "");
  }
  return undefined;
}
