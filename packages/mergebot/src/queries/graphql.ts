import { initGraphQLTada } from "gql.tada";
import type { introspection } from "./schema/tada-env";

export const graphql = initGraphQLTada<{
  introspection: introspection;
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
