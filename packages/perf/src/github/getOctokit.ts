import Octokit from "@octokit/rest";
import { config } from "../common";

let octokit: Octokit | undefined;
export function getOctokit() {
  return (
    octokit ||
    (octokit = new Octokit({
      auth: config.github.typeScriptBotAuthToken,
      userAgent: config.github.userAgent
    }))
  );
}
