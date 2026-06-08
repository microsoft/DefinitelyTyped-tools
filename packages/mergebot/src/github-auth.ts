import { DefaultAzureCredential } from "@azure/identity";
import { CryptographyClient } from "@azure/keyvault-keys";
import { createGitHubAppAuth } from "./util/github-app-auth";

type PermissionLevel = "read" | "write" | "admin";
type GitHubAppAuth = ReturnType<typeof createGitHubAppAuth>;

let githubAuth: GitHubAppAuth | undefined;

function explicitToken() {
  if (process.env.JEST_WORKER_ID) return "FAKE_TOKEN";
  return process.env.BOT_AUTH_TOKEN || process.env.DT_BOT_AUTH_TOKEN || process.env.AUTH_TOKEN;
}

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} must be set`);
  }
  return value;
}

function getGitHubAuth() {
  if (!githubAuth) {
    const cryptographyClient = new CryptographyClient(
      requiredEnv("GITHUB_APP_KEY_VAULT_KEY_ID"),
      new DefaultAzureCredential(),
    );
    githubAuth = createGitHubAppAuth({
      appClientId: requiredEnv("GITHUB_APP_CLIENT_ID"),
      signer: async (signingInput) => {
        const signature = await cryptographyClient.signData("RS256", Buffer.from(signingInput));
        return Buffer.from(signature.result).toString("base64url");
      },
      defaultOwner: process.env.GITHUB_APP_INSTALLATION_OWNER || "DefinitelyTyped",
    });
  }
  return githubAuth;
}

function permissions() {
  const raw = process.env.GITHUB_APP_PERMISSIONS;
  if (!raw) {
    return undefined;
  }
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("GITHUB_APP_PERMISSIONS must be a JSON object");
  }
  const result: Record<string, PermissionLevel> = {};
  for (const [permission, level] of Object.entries(parsed)) {
    if (level !== "read" && level !== "write" && level !== "admin") {
      throw new Error(`Invalid GitHub App permission level for ${permission}: ${level}`);
    }
    result[permission] = level;
  }
  return result;
}

export async function getGitHubAuthToken() {
  const token = explicitToken();
  if (token) {
    return token.trim();
  }

  return getGitHubAuth().getToken({
    repositories: [process.env.GITHUB_APP_INSTALLATION_REPO || "DefinitelyTyped"],
    permissions: permissions() ?? {
      checks: "write",
      contents: "read",
      discussions: "write",
      issues: "write",
      organization_projects: "write",
      pull_requests: "write",
    },
  });
}
