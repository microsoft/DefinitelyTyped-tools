import { initGraphQLTada } from "gql.tada";

export const graphql = initGraphQLTada<{
  introspection: import("./schema/tada-env").introspection;
  scalars: {
    URI: string;
    DateTime: string;
    GitObjectID: string;
    HTML: string;
    Date: string;
    PreciseDateTime: string;
    X509Certificate: string;
    GitSSHRemote: string;
    Base64String: string;
    GitTimestamp: string;
    BigInt: string;
  };
}>();
