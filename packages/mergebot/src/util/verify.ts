import { verify } from "@octokit/webhooks-methods";
import type { InvocationContext } from "@azure/functions";

export async function httpLog(context: InvocationContext, headers: Headers, body: any) {
  const githubId = headers.get("x-github-delivery");
  const event = headers.get("x-github-event")!;
  context.log(
    `>>> HTTP Trigger ${context.functionName} [${event}.${body.action}; gh: ${githubId}; az: ${context.invocationId}; node: ${process.version}]`,
  );
}

export async function shouldRunRequest(
  context: InvocationContext,
  headers: Headers,
  body: any,
  canHandleRequest?: (event: string, action: string) => boolean,
) {
  const isDev = process.env.AZURE_FUNCTIONS_ENVIRONMENT === "Development";
  // For process.env.GITHUB_WEBHOOK_SECRET see
  // https://ms.portal.azure.com/#blade/WebsitesExtension/FunctionsIFrameBlade/id/%2Fsubscriptions%2F57bfeeed-c34a-4ffd-a06b-ccff27ac91b8%2FresourceGroups%2Fdtmergebot%2Fproviders%2FMicrosoft.Web%2Fsites%2FDTMergeBot
  const fromGitHub = await verifyIsFromGitHub(headers, body);
  if (!isDev && !fromGitHub) {
    context.log("Request did not come from GitHub");
    return false;
  }

  // Optional function for early bailing if it returns false
  if (canHandleRequest && !canHandleRequest(headers.get("x-github-event")!, body.action)) {
    context.log("canHandleRequest returned false");
    return false;
  }

  return true;
}

export async function verifyIsFromGitHub(headers: Headers, body: any) {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;

  // For process.env.GITHUB_WEBHOOK_SECRET see
  // https://ms.portal.azure.com/#blade/WebsitesExtension/FunctionsIFrameBlade/id/%2Fsubscriptions%2F57bfeeed-c34a-4ffd-a06b-ccff27ac91b8%2FresourceGroups%2Fdtmergebot%2Fproviders%2FMicrosoft.Web%2Fsites%2FDTMergeBot
  return verify(secret!, JSON.stringify(body), headers.get("x-hub-signature-256")!);
}
