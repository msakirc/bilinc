import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  QueryCommand,
  BatchGetCommand,
} from '@aws-sdk/lib-dynamodb';
import { fromCognitoIdentityPool } from '@aws-sdk/credential-providers';
import { AWS_REGION, COGNITO_IDENTITY_POOL_ID, DYNAMODB_TABLE } from '../aws/config';

// Browser port of mobile/src/services/dynamodb.ts. In the browser the AWS SDK
// ships a working fetch-based request handler by default, so — unlike RN — we
// don't force @smithy/fetch-http-handler. Credentials come from the same
// Cognito unauthenticated identity pool used by the search proxy.

// ─── Client ────────────────────────────────────────────────────────

const rawClient = new DynamoDBClient({
  region: AWS_REGION,
  credentials: fromCognitoIdentityPool({
    identityPoolId: COGNITO_IDENTITY_POOL_ID,
    clientConfig: { region: AWS_REGION },
  }),
});

const ddb = DynamoDBDocumentClient.from(rawClient, {
  marshallOptions: { removeUndefinedValues: true },
});

// ─── RAW types (returned as-is, NOT mapped to web's domain types) ──

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

type DynamoKey = Record<string, unknown>;

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
  const resp = await ddb.send(
    new GetCommand({
      TableName: DYNAMODB_TABLE,
      Key: { PK: `L#${id}`, SK: 'META' },
    }),
  );
  return resp.Item ? parseListing(resp.Item) : null;
}

/**
 * Browse listings by category, sorted by rating (descending via inverted SK).
 * DynamoDB: Query GSI1-category, PK=CAT#<slug>
 */
export async function browseByCategory(
  categorySlug: string,
  limit = 20,
  startKey?: DynamoKey,
): Promise<{ items: CatalogListingCard[]; lastKey?: DynamoKey }> {
  const resp = await ddb.send(
    new QueryCommand({
      TableName: DYNAMODB_TABLE,
      IndexName: 'GSI1-category',
      KeyConditionExpression: 'GSI1PK = :pk',
      ExpressionAttributeValues: { ':pk': `CAT#${categorySlug}` },
      Limit: limit,
      ExclusiveStartKey: startKey,
    }),
  );
  return {
    items: (resp.Items || []).map(parseCard),
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
  startKey?: DynamoKey,
): Promise<{ items: CatalogListingCard[]; lastKey?: DynamoKey }> {
  const resp = await ddb.send(
    new QueryCommand({
      TableName: DYNAMODB_TABLE,
      IndexName: 'GSI2-city',
      KeyConditionExpression: 'GSI2PK = :pk AND begins_with(GSI2SK, :prefix)',
      ExpressionAttributeValues: {
        ':pk': `CITY#${cityCode}`,
        ':prefix': `CAT#${categorySlug}#R#`,
      },
      Limit: limit,
      ExclusiveStartKey: startKey,
    }),
  );
  return {
    items: (resp.Items || []).map(parseCard),
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
  const resp = await ddb.send(
    new QueryCommand({
      TableName: DYNAMODB_TABLE,
      IndexName: 'GSI3-type',
      KeyConditionExpression: 'GSI3PK = :pk',
      ExpressionAttributeValues: { ':pk': `TYPE#${entityType}` },
      ScanIndexForward: false,
      Limit: limit,
    }),
  );
  // The entity type is implied by the GSI3 partition (TYPE#<type>) but isn't
  // always stored as a top-level item attribute, so backfill it from the query
  // key — otherwise cards come back with entityType undefined and the UI badge
  // renders the raw i18n key.
  return (resp.Items || [])
    .map(parseCard)
    .map((c) => ({ ...c, entityType: c.entityType || entityType }));
}

/**
 * Get products/branches belonging to a brand/company.
 * DynamoDB: Query GSI4-parent, PK=PARENT#L#<brandId>
 */
export async function getBrandProducts(
  brandId: string,
  limit = 50,
): Promise<CatalogListingCard[]> {
  const resp = await ddb.send(
    new QueryCommand({
      TableName: DYNAMODB_TABLE,
      IndexName: 'GSI4-parent',
      KeyConditionExpression: 'GSI4PK = :pk',
      ExpressionAttributeValues: { ':pk': `PARENT#L#${brandId}` },
      Limit: limit,
    }),
  );
  return (resp.Items || []).map(parseCard);
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
    const resp = await ddb.send(
      new BatchGetCommand({
        RequestItems: {
          [DYNAMODB_TABLE]: {
            Keys: chunk.map((id) => ({ PK: `L#${id}`, SK: 'META' })),
          },
        },
      }),
    );
    const items = resp.Responses?.[DYNAMODB_TABLE] || [];
    results.push(...items.map(parseListing));
  }

  return results;
}
