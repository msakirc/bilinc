const AWS_REGION = process.env.EXPO_PUBLIC_AWS_REGION || 'eu-central-1';
const COGNITO_IDENTITY_POOL_ID = process.env.EXPO_PUBLIC_COGNITO_IDENTITY_POOL_ID || '';
const DYNAMODB_TABLE = process.env.EXPO_PUBLIC_DYNAMODB_TABLE || 'bilinc-catalog';
// Lambda Function URL of the search proxy (AWS_IAM auth, signed with Cognito creds).
const SEARCH_URL = process.env.EXPO_PUBLIC_SEARCH_URL || '';

export { AWS_REGION, COGNITO_IDENTITY_POOL_ID, DYNAMODB_TABLE, SEARCH_URL };
