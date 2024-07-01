import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { getPRInfo } from "../queries/pr-query";
const headers = {
  "Content-Type": "text/json",
  "Access-Control-Allow-Methods": "GET",
  "Access-Control-Allow-Origin": "https://www.typescriptlang.org",
  Vary: "Origin",
};
const notFound = (reason: string) => ({
  headers,
  status: 404,
  body: reason,
});
export async function httpTrigger(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
  context.log(`This time it was "${request.url}"`);

  const prNumber = Number(request.query.get("number"));
  if (!prNumber || isNaN(prNumber)) return notFound("No PR number");

  const info = await getPRInfo(prNumber);
  const prInfo = info.data.repository?.pullRequest;

  if (!prInfo) return notFound("No PR metadata");

  const welcomeComment = prInfo.comments.nodes!.find(
    (c) => c && c.author?.login === "typescript-bot" && c.body.endsWith("<!--typescript_bot_welcome-->"),
  );
  if (!welcomeComment || !welcomeComment.body || !welcomeComment.body.includes("```json"))
    return notFound("PR comment with JSON not found");

  // Extract the JSON from the comment
  const jsonText = welcomeComment.body.replace(/^[^]*```json\n([^]*)\n```[^]*$/, "$1");
  const response = { title: prInfo.title, ...JSON.parse(jsonText) };
  return { headers, status: 200, body: JSON.stringify(response) };
}
// Allow all others to access this, we can
// tighten this down to the TS URLs if the route is abused
app.http("Playground-Info", {
  methods: ["GET", "POST"],
  authLevel: "anonymous",
  handler: httpTrigger,
});
