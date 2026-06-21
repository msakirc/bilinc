import { SignatureV4 } from '@smithy/signature-v4';
import { Sha256 } from '@aws-crypto/sha256-js';
import { AWS_REGION, DYNAMODB_TABLE } from '../config/aws';
import { cognitoUnauthCredentials } from './search';

// ─── Transport ─────────────────────────────────────────────────────
// The @aws-sdk DynamoDB client crashes on RN *release* builds with
// "Symbol(node-only) is not a function": its checksum middleware calls a
// node-only `Hash` that @smithy stubs out on React Native (see
// @smithy/core .native build — `const Hash = Symbol.for("node-only")`).
// No metro config can fix that; the client fundamentally needs a node hash.
// So — exactly like search.ts already does for the Lambda proxy — we sign raw
// DynamoDB JSON-API requests by hand (SigV4 + pure-JS SHA-256) and POST them
// with fetch. No @aws-sdk client, no node-only code paths.

const HOST = `dynamodb.${AWS_REGION}.amazonaws.com`;

const signer = new SignatureV4({
  service: 'dynamodb',
  region: AWS_REGION,
  credentials: cognitoUnauthCredentials,
  sha256: Sha256,
});

// DynamoDB attribute-value (un)marshalling — RN-safe, dependency-free.
// Mirrors what DynamoDBDocumentClient used to do, so parseListing/parseCard
// keep receiving plain JS objects with numbers as numbers.
type AV = Record<string, any>;

function marshallValue(v: any): AV {
  if (v === null || v === undefined) return { NULL: true };
  switch (typeof v) {
    case 'string':
      return { S: v };
    case 'number':
      return { N: String(v) };
    case 'boolean':
      return { BOOL: v };
    case 'object':
      return Array.isArray(v) ? { L: v.map(marshallValue) } : { M: marshall(v) };
    default:
      return { S: String(v) };
  }
}

function marshall(obj: Record<string, any>): AV {
  const out: AV = {};
  for (const [k, val] of Object.entries(obj)) {
    if (val === undefined) continue;
    out[k] = marshallValue(val);
  }
  return out;
}

function unmarshallValue(av: AV): any {
  if (av == null) return undefined;
  if ('S' in av) return av.S;
  if ('N' in av) return Number(av.N);
  if ('BOOL' in av) return av.BOOL;
  if ('NULL' in av) return null;
  if ('M' in av) return unmarshall(av.M);
  if ('L' in av) return (av.L as AV[]).map(unmarshallValue);
  if ('SS' in av) return av.SS;
  if ('NS' in av) return (av.NS as string[]).map(Number);
  if ('BS' in av) return av.BS;
  return undefined;
}

function unmarshall(item: AV): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [k, av] of Object.entries(item || {})) {
    out[k] = unmarshallValue(av as AV);
  }
  return out;
}

/** Sign + POST a DynamoDB JSON-API request; return the parsed JSON body. */
async function ddbRequest(target: string, payload: Record<string, any>): Promise<any> {
  const body = JSON.stringify(payload);
  const signed = await signer.sign({
    method: 'POST',
    protocol: 'https:',
    hostname: HOST,
    path: '/',
    headers: {
      host: HOST,
      'content-type': 'application/x-amz-json-1.0',
      'x-amz-target': `DynamoDB_20120810.${target}`,
    },
    body,
  });
  const resp = await fetch(`https://${HOST}/`, {
    method: 'POST',
    headers: signed.headers,
    body,
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`DynamoDB ${target} ${resp.status}: ${text.slice(0, 200)}`);
  }
  return resp.json();
}

// ─── Types ─────────────────────────────────────────────────────────

export interface CatalogListing {
  id: string;
  name: string;
  slug: string;
  entityType: 'business' | 'product' | 'brand';
  status: string;
  description?: string;
  cityCode?: string;
  districtId?: number;
  addressLine?: string;
  latitude?: number;
  longitude?: number;
  rating: number;
  totalReviews: number;
  source?: string;
  sourceId?: string;
  parentId?: string;
  createdAt: string;
  updatedAt?: string;
  contacts?: Record<string, string>;
  hours?: Array<{ day: number; open?: string; close?: string; closed?: boolean }>;
  photos?: Array<{ url: string; primary?: boolean; source?: string }>;
  categories?: Array<{ slug: string; primary?: boolean }>;
  productData?: {
    barcode?: string;
    allBarcodes?: string[];
    brand?: string;
    nutriscore?: string;
    novaGroup?: number;
    ingredients?: string;
    imageUrl?: string;
  };
}

export interface CatalogListingCard {
  id: string;
  name: string;
  slug: string;
  entityType: string;
  cityCode?: string;
  rating: number;
  totalReviews: number;
  photos?: Array<{ url: string; primary?: boolean }>;
}

// ─── Helpers ───────────────────────────────────────────────────────

function parseListing(item: Record<string, any>): CatalogListing {
  return {
    ...item,
    id: (item.PK as string).replace('L#', ''),
    parentId: item.parentId?.replace('L#', '') || undefined,
    rating: Number(item.rating || 0),
    totalReviews: Number(item.totalReviews || 0),
    latitude: item.latitude != null ? Number(item.latitude) : undefined,
    longitude: item.longitude != null ? Number(item.longitude) : undefined,
  } as CatalogListing;
}

function parseCard(item: Record<string, any>): CatalogListingCard {
  return {
    id: (item.PK as string).replace('L#', ''),
    name: item.name,
    slug: item.slug,
    entityType: item.entityType,
    cityCode: item.cityCode,
    rating: Number(item.rating || 0),
    totalReviews: Number(item.totalReviews || 0),
    photos: item.photos,
  };
}

// ─── Queries ───────────────────────────────────────────────────────

/**
 * Get a single listing by ID.
 * DynamoDB: GetItem PK=L#<id> SK=META
 */
export async function getListing(id: string): Promise<CatalogListing | null> {
  const resp = await ddbRequest('GetItem', {
    TableName: DYNAMODB_TABLE,
    Key: { PK: { S: `L#${id}` }, SK: { S: 'META' } },
  });
  return resp.Item ? parseListing(unmarshall(resp.Item)) : null;
}

/**
 * Browse listings by category, sorted by rating (descending via inverted SK).
 * DynamoDB: Query GSI1-category, PK=CAT#<slug>
 */
export async function browseByCategory(
  categorySlug: string,
  limit = 20,
  startKey?: Record<string, any>,
): Promise<{ items: CatalogListingCard[]; lastKey?: Record<string, any> }> {
  const resp = await ddbRequest('Query', {
    TableName: DYNAMODB_TABLE,
    IndexName: 'GSI1-category',
    KeyConditionExpression: 'GSI1PK = :pk',
    ExpressionAttributeValues: { ':pk': { S: `CAT#${categorySlug}` } },
    Limit: limit,
    ExclusiveStartKey: startKey,
  });
  return {
    items: (resp.Items || []).map((it: AV) => parseCard(unmarshall(it))),
    lastKey: resp.LastEvaluatedKey,
  };
}

/**
 * Browse listings by city + category, sorted by rating.
 * DynamoDB: Query GSI2-city, PK=CITY#<code>, SK begins_with CAT#<slug>#R#
 */
export async function browseByCityCategory(
  cityCode: string,
  categorySlug: string,
  limit = 20,
  startKey?: Record<string, any>,
): Promise<{ items: CatalogListingCard[]; lastKey?: Record<string, any> }> {
  const resp = await ddbRequest('Query', {
    TableName: DYNAMODB_TABLE,
    IndexName: 'GSI2-city',
    KeyConditionExpression: 'GSI2PK = :pk AND begins_with(GSI2SK, :prefix)',
    ExpressionAttributeValues: {
      ':pk': { S: `CITY#${cityCode}` },
      ':prefix': { S: `CAT#${categorySlug}#R#` },
    },
    Limit: limit,
    ExclusiveStartKey: startKey,
  });
  return {
    items: (resp.Items || []).map((it: AV) => parseCard(unmarshall(it))),
    lastKey: resp.LastEvaluatedKey,
  };
}

/**
 * Get recently added listings by entity type.
 * DynamoDB: Query GSI3-type, PK=TYPE#<type>, ScanIndexForward=false (newest first)
 */
export async function getRecentByType(
  entityType: string,
  limit = 20,
): Promise<CatalogListingCard[]> {
  const resp = await ddbRequest('Query', {
    TableName: DYNAMODB_TABLE,
    IndexName: 'GSI3-type',
    KeyConditionExpression: 'GSI3PK = :pk',
    ExpressionAttributeValues: { ':pk': { S: `TYPE#${entityType}` } },
    ScanIndexForward: false,
    Limit: limit,
  });
  return (resp.Items || []).map((it: AV) => parseCard(unmarshall(it)));
}

/**
 * Get products/branches belonging to a brand/company.
 * DynamoDB: Query GSI4-parent, PK=PARENT#L#<brandId>
 */
export async function getBrandProducts(
  brandId: string,
  limit = 50,
): Promise<CatalogListingCard[]> {
  const resp = await ddbRequest('Query', {
    TableName: DYNAMODB_TABLE,
    IndexName: 'GSI4-parent',
    KeyConditionExpression: 'GSI4PK = :pk',
    ExpressionAttributeValues: { ':pk': { S: `PARENT#L#${brandId}` } },
    Limit: limit,
  });
  return (resp.Items || []).map((it: AV) => parseCard(unmarshall(it)));
}

/**
 * Batch-get full listing items by IDs. Chunks into groups of 100
 * (DynamoDB BatchGetItem limit).
 */
export async function batchGetListings(ids: string[]): Promise<CatalogListing[]> {
  if (ids.length === 0) return [];

  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += 100) {
    chunks.push(ids.slice(i, i + 100));
  }

  const results: CatalogListing[] = [];

  for (const chunk of chunks) {
    const resp = await ddbRequest('BatchGetItem', {
      RequestItems: {
        [DYNAMODB_TABLE]: {
          Keys: chunk.map((id) => ({ PK: { S: `L#${id}` }, SK: { S: 'META' } })),
        },
      },
    });
    const items: AV[] = resp.Responses?.[DYNAMODB_TABLE] || [];
    results.push(...items.map((it) => parseListing(unmarshall(it))));
  }

  return results;
}
