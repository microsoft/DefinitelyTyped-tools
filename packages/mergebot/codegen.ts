import type { CodegenConfig } from "@graphql-codegen/cli";

const config: CodegenConfig = {
  schema: "./node_modules/@octokit/graphql-schema/schema.graphql",
  documents: ["src/queries/**/*.ts"],
  ignoreNoDocuments: true,
  generates: {
    "./src/queries/schema/": {
      preset: "client",
      config: {
        useTypeImports: true,
        enumsAsTypes: false,
        onlyOperationTypes: true,
        scalars: {
          URI: "string",
          DateTime: "string",
          GitObjectID: "string",
          HTML: "string",
          Date: "string",
          PreciseDateTime: "string",
          X509Certificate: "string",
          GitSSHRemote: "string",
          Base64String: "string",
          GitTimestamp: "string",
          BigInt: "string",
        },
      },
      presetConfig: {
        fragmentMasking: false,
      },
    },
  },
};

export default config;
