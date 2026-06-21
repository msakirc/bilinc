// Throwaway health check for the AWS catalog (DynamoDB) + search (Lambda proxy)
// backend. Standalone ESM — inlines the same Cognito-unauth + SigV4 + DynamoDB
// logic as web/src/lib/* so we don't have to do TS<->ESM interop. Hardcodes the
// PUBLIC unauth NEXT_PUBLIC_* values.
//
// Run:  node scripts/catalog-health.mjs   (from web/)

import { SignatureV4 } from '@smithy/signature-v4';
import { Sha256 } from '@aws-crypto/sha256-js';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { fromCognitoIdentityPool } from '@aws-sdk/credential-providers';

const AWS_REGION = 'eu-central-1';
const COGNITO_IDENTITY_POOL_ID = 'eu-central-1:cf66e6b8-e288-46b1-8f74-e9f32bf497d5';
const DYNAMODB_TABLE = 'bilinc-catalog';
const SEARCH_URL = 'https://2ljm4c7rf7y5gkwsaqy6qpfm5e0skqtj.lambda-url.eu-central-1.on.aws/';

// ─── Cognito unauth creds (plain fetch) ─────────────────────────────
let _credsCache = null;
async function cognitoUnauthCredentials() {
  if (_credsCache && _credsCache.expiresAt - 60_000 > Date.now()) return _credsCache.value;
  const endpoint = `https://cognito-identity.${AWS_REGION}.amazonaws.com/`;
  const post = async (target, body) => {
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
  const { IdentityId } = await post('GetId', { IdentityPoolId: COGNITO_IDENTITY_POOL_ID });
  const { Credentials } = await post('GetCredentialsForIdentity', { IdentityId });
  const value = {
    accessKeyId: Credentials.AccessKeyId,
    secretAccessKey: Credentials.SecretKey,
    sessionToken: Credentials.SessionToken,
  };
  const expMs = Credentials.Expiration ? Number(Credentials.Expiration) * 1000 : Date.now() + 3_000_000;
  _credsCache = { value, expiresAt: expMs };
  return value;
}

// ─── Search proxy (SigV4 POST) ──────────────────────────────────────
const signer = new SignatureV4({
  service: 'lambda',
  region: AWS_REGION,
  credentials: cognitoUnauthCredentials,
  sha256: Sha256,
});

async function callProxy(payload) {
  const url = new URL(SEARCH_URL);
  const body = JSON.stringify(payload);
  const signed = await signer.sign({
    method: 'POST',
    protocol: url.protocol,
    hostname: url.hostname,
    path: url.pathname || '/',
    headers: { host: url.hostname, 'content-type': 'application/json' },
    body,
  });
  const resp = await fetch(SEARCH_URL, { method: 'POST', headers: signed.headers, body });
  if (!resp.ok) throw new Error(`proxy HTTP ${resp.status} ${resp.statusText}: ${await resp.text()}`);
  const data = await resp.json();
  return data.results ?? [];
}

async function searchListings(query, opts = {}) {
  const { cityCode, entityType, categorySlug, limit = 20, offset = 0 } = opts;
  return callProxy({ op: 'search', q: query, cityCode, entityType, categorySlug, limit, offset });
}

// ─── DynamoDB ───────────────────────────────────────────────────────
const rawClient = new DynamoDBClient({
  region: AWS_REGION,
  credentials: fromCognitoIdentityPool({
    identityPoolId: COGNITO_IDENTITY_POOL_ID,
    clientConfig: { region: AWS_REGION },
  }),
});
const ddb = DynamoDBDocumentClient.from(rawClient, { marshallOptions: { removeUndefinedValues: true } });

function parseCard(item) {
  return {
    id: String(item.PK).replace('L#', ''),
    name: item.name,
    slug: item.slug,
    entityType: item.entityType,
    cityCode: item.cityCode,
    rating: Number(item.rating || 0),
    totalReviews: Number(item.totalReviews || 0),
    photos: item.photos,
  };
}
function parseListing(item) {
  return {
    ...item,
    id: String(item.PK).replace('L#', ''),
    parentId: item.parentId ? String(item.parentId).replace('L#', '') : undefined,
    rating: Number(item.rating || 0),
    totalReviews: Number(item.totalReviews || 0),
    latitude: item.latitude != null ? Number(item.latitude) : undefined,
    longitude: item.longitude != null ? Number(item.longitude) : undefined,
  };
}

async function getRecentByType(entityType, limit = 20) {
  const resp = await ddb.send(new QueryCommand({
    TableName: DYNAMODB_TABLE,
    IndexName: 'GSI3-type',
    KeyConditionExpression: 'GSI3PK = :pk',
    ExpressionAttributeValues: { ':pk': `TYPE#${entityType}` },
    ScanIndexForward: false,
    Limit: limit,
  }));
  return (resp.Items || []).map(parseCard);
}

async function getListing(id) {
  const resp = await ddb.send(new GetCommand({
    TableName: DYNAMODB_TABLE,
    Key: { PK: `L#${id}`, SK: 'META' },
  }));
  return resp.Item ? parseListing(resp.Item) : null;
}

// ─── Run ────────────────────────────────────────────────────────────
function hr(label) { console.log('\n' + '─'.repeat(8) + ' ' + label + ' ' + '─'.repeat(8)); }

(async () => {
  let searchOk = false, ddbOk = false;

  // (a) search "Test"
  hr('(a) searchListings("Test")');
  try {
    const results = await searchListings('Test', { limit: 5 });
    console.log('count:', results.length);
    if (results[0]) console.log('sample:', JSON.stringify(results[0], null, 2));
    searchOk = true;
  } catch (e) {
    console.error('SEARCH ERROR:', e?.message || e);
  }

  // (b) getRecentByType("business", 3)
  hr('(b) getRecentByType("business", 3)');
  let firstId = null;
  try {
    const recent = await getRecentByType('business', 3);
    console.log('count:', recent.length);
    if (recent[0]) {
      console.log('sample:', JSON.stringify(recent[0], null, 2));
      firstId = recent[0].id;
    }
    ddbOk = true;
  } catch (e) {
    console.error('DDB getRecentByType ERROR:', e?.message || e);
  }

  // (c) getListing(thatId)
  hr('(c) getListing(firstId)');
  if (firstId) {
    try {
      const item = await getListing(firstId);
      console.log('id:', firstId, '->', item ? 'FOUND' : 'NULL');
      if (item) console.log('sample:', JSON.stringify(item, null, 2));
    } catch (e) {
      console.error('DDB getListing ERROR:', e?.message || e);
    }
  } else {
    console.log('skipped — no id from (b)');
  }

  hr('VERDICT');
  console.log('search reachable:', searchOk);
  console.log('dynamodb reachable:', ddbOk);
})();
