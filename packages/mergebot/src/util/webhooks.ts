import type { operations } from "@octokit/openapi-webhooks-types";

export type WebhookEvent<Operation extends keyof operations> =
  operations[Operation]["requestBody"]["content"]["application/json"];
