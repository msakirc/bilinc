/// <reference path="./.sst/platform/config.d.ts" />

// SST v3 (Ion) deploy for the Bilinç Next.js web app.
//
// Targets AWS via OpenNext under the hood: Lambda (server) + CloudFront + S3.
// Region is pinned to eu-central-1 to sit next to the catalog DynamoDB table and
// the search Lambda (same account/region as mobile's data layer) — minimal
// cross-region latency and $0/mo at launch traffic (Lambda + CloudFront always-free).
//
// Deploy (pick the AWS profile that owns the catalog Lambda):
//   AWS_PROFILE=bilinc-serverless npx sst deploy --stage prod
//
// All NEXT_PUBLIC_* values below are non-secret unauthenticated client config
// (mirrors web/src/lib/aws/config.ts). They are read from the deployer's env
// (.env.local locally / CI secrets in pipeline), with the same public defaults
// as mobile as a fallback so a missing var fails loud only for the truly required ones.
export default $config({
  app(input) {
    return {
      name: "bilinc-web",
      // prod resources survive `sst remove`; non-prod stages are disposable.
      removal: input?.stage === "prod" ? "retain" : "remove",
      protect: ["prod"].includes(input?.stage ?? ""),
      home: "aws",
      providers: {
        aws: {
          region: "eu-central-1",
        },
      },
    };
  },
  async run() {
    new sst.aws.Nextjs("Web", {
      path: ".",
      // Build-time inlined into the client bundle + available to the server Lambda.
      environment: {
        NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL!,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        NEXT_PUBLIC_AWS_REGION:
          process.env.NEXT_PUBLIC_AWS_REGION ?? "eu-central-1",
        NEXT_PUBLIC_COGNITO_IDENTITY_POOL_ID:
          process.env.NEXT_PUBLIC_COGNITO_IDENTITY_POOL_ID!,
        NEXT_PUBLIC_DYNAMODB_TABLE:
          process.env.NEXT_PUBLIC_DYNAMODB_TABLE ?? "bilinc-catalog",
        NEXT_PUBLIC_SEARCH_URL: process.env.NEXT_PUBLIC_SEARCH_URL!,
      },
    });
  },
});
