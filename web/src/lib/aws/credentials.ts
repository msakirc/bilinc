import type { AwsCredentialIdentity } from '@smithy/types';
import { AWS_REGION, COGNITO_IDENTITY_POOL_ID } from './config';

// Hand-rolled Cognito UNAUTH credentials via plain fetch. Ported from
// mobile/src/services/search.ts. GetId + GetCredentialsForIdentity are
// unsigned JSON POSTs against the Cognito Identity endpoint, so the browser's
// native fetch is enough — no @aws-sdk client needed for this path. Results are
// cached with a 60s expiry buffer.

let _credsCache: { value: AwsCredentialIdentity; expiresAt: number } | null = null;

export async function cognitoUnauthCredentials(): Promise<AwsCredentialIdentity> {
  if (_credsCache && _credsCache.expiresAt - 60_000 > Date.now()) {
    return _credsCache.value;
  }

  const endpoint = `https://cognito-identity.${AWS_REGION}.amazonaws.com/`;
  const post = async (target: string, body: object) => {
    const r = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-amz-json-1.1',
        'x-amz-target': `AWSCognitoIdentityService.${target}`,
      },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error(`Cognito ${target} ${r.status}: ${await r.text()}`);
    return r.json();
  };

  const { IdentityId } = await post('GetId', {
    IdentityPoolId: COGNITO_IDENTITY_POOL_ID,
  });
  const { Credentials } = await post('GetCredentialsForIdentity', { IdentityId });

  const value: AwsCredentialIdentity = {
    accessKeyId: Credentials.AccessKeyId,
    secretAccessKey: Credentials.SecretKey,
    sessionToken: Credentials.SessionToken,
  };
  const expMs = Credentials.Expiration
    ? Number(Credentials.Expiration) * 1000
    : Date.now() + 3_000_000;
  _credsCache = { value, expiresAt: expMs };
  return value;
}
