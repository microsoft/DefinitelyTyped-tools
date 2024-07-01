import { ApolloClient, gql, HttpLink, InMemoryCache, MutationOptions, TypedDocumentNode } from "@apollo/client/core";
import { print } from "graphql";
import * as schema from "@octokit/graphql-schema/schema";

// get the values directly from the apollo config
const apolloCfg = require("../apollo.config.js").client.service;

const uri = apolloCfg.url;
const headers = {
  ...apolloCfg.headers,
  authorization: `Bearer ${getAuthToken()}`,
};

const cache = new InMemoryCache();
const link = new HttpLink({ uri, headers, fetch });

export const client = new ApolloClient({ cache, link });

export function createMutation<T>(
  name: keyof schema.Mutation,
  input: T,
  subquery?: string,
): MutationOptions<void, { input: T }> {
  const mutation = {
    toJSON: () => print(mutation),
    ...(gql`mutation($input: ${name[0]!.toUpperCase() + name.slice(1)}Input!) {
                    ${name}(input: $input) {
                        __typename
                        ${subquery || ""}
                    }
                }` as TypedDocumentNode<void, { input: T }>),
  };
  return { mutation, variables: { input } };
}

function getAuthToken() {
  if (process.env.JEST_WORKER_ID) return "FAKE_TOKEN";

  const result = process.env.BOT_AUTH_TOKEN || process.env.AUTH_TOKEN || process.env.DT_BOT_AUTH_TOKEN;
  if (typeof result !== "string") {
    throw new Error("Set BOT_AUTH_TOKEN or AUTH_TOKEN to a valid auth token");
  }
  return result.trim();
}
