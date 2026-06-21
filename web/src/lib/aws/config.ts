// Public unauth client config for the AWS catalog (DynamoDB) + search (Lambda
// proxy) data layer. Mirrors mobile/src/config/aws.ts. These NEXT_PUBLIC_*
// values are non-secret unauthenticated client config (Cognito identity pool +
// table name + Lambda Function URL). Same defaults as mobile.

const AWS_REGION = process.env.NEXT_PUBLIC_AWS_REGION || 'eu-central-1';
const COGNITO_IDENTITY_POOL_ID =
  process.env.NEXT_PUBLIC_COGNITO_IDENTITY_POOL_ID || '';
const DYNAMODB_TABLE = process.env.NEXT_PUBLIC_DYNAMODB_TABLE || 'bilinc-catalog';
// Lambda Function URL of the search proxy (AWS_IAM auth, signed with Cognito creds).
const SEARCH_URL = process.env.NEXT_PUBLIC_SEARCH_URL || '';

export { AWS_REGION, COGNITO_IDENTITY_POOL_ID, DYNAMODB_TABLE, SEARCH_URL };
