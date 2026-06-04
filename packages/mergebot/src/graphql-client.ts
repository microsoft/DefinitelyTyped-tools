import { ApolloClient, gql, HttpLink, InMemoryCache, MutationOptions, TypedDocumentNode } from "@apollo/client/core";
import { print } from "graphql";
import * as schema from "@octokit/graphql-schema";
import { getGitHubAuthToken } from "./github-auth";

const uri = "https://api.github.com/graphql";
const accept = "application/vnd.github.starfox-preview+json, application/vnd.github.bane-preview+json";

const cache = new InMemoryCache();
const link = new HttpLink({
  uri,
  fetch: async (input, init) =>
    fetch(input, {
      ...init,
      headers: {
        ...init?.headers,
        authorization: `Bearer ${await getGitHubAuthToken()}`,
        accept,
      },
    }),
});

export const client = new ApolloClient({ cache, link });

export function createMutation<T>(
  name: keyof schema.Mutation,
  input: T,
  subquery?: string,
): MutationOptions<schema.Mutation, { input: T }> {
  const mutation = {
    toJSON: () => print(mutation),
    ...(gql`mutation($input: ${name[0]!.toUpperCase() + name.slice(1)}Input!) {
                    ${name}(input: $input) {
                        __typename
                        ${subquery || ""}
                    }
                }` as TypedDocumentNode<schema.Mutation, { input: T }>),
  };
  return { mutation, variables: { input } };
}
