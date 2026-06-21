/**
 * Pure unit tests for parseListing and parseCard (internal DynamoDB helpers).
 *
 * parseListing and parseCard are not exported, so we test them indirectly
 * through the exported getListing() and browseByCategory() functions by mocking
 * the AWS SDK send() method and asserting the exact output shape.
 *
 * No mocks of the functions under test — only the DynamoDB I/O boundary is mocked.
 */

// We store the mock send on the module-level object so jest.mock factory can reference it.
// jest.mock factories run in a separate scope — cannot close over local consts.
const _ddbMocks = { send: jest.fn() };

jest.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('@aws-sdk/lib-dynamodb', () => {
  // Use a stable object shared via the outer _ddbMocks.
  // Note: jest.mock hoisting means we can NOT close over _ddbMocks here.
  // Instead, we create an inner mock send and expose it on module exports.
  const mockSend = jest.fn();
  const mockFrom = jest.fn().mockReturnValue({ send: mockSend });
  return {
    __mockSend: mockSend,
    __mockFrom: mockFrom,
    DynamoDBDocumentClient: {
      from: mockFrom,
    },
    GetCommand: jest.fn().mockImplementation((input) => ({ _type: 'GetCommand', ...input })),
    QueryCommand: jest.fn().mockImplementation((input) => ({ _type: 'QueryCommand', ...input })),
    BatchGetCommand: jest.fn().mockImplementation((input) => ({ _type: 'BatchGetCommand', ...input })),
  };
});

jest.mock('@aws-sdk/credential-providers', () => ({
  fromCognitoIdentityPool: jest.fn().mockReturnValue({}),
}));

jest.mock('../../config/aws', () => ({
  AWS_REGION: 'eu-west-1',
  COGNITO_IDENTITY_POOL_ID: 'eu-west-1:test-pool',
  DYNAMODB_TABLE: 'test-table',
}));

// Import after mocks are set up
import * as ddbLibMock from '@aws-sdk/lib-dynamodb';
import { getListing, browseByCategory } from '../dynamodb';

// Get the mock send and from functions exposed by the mock factory
const mockSend: jest.Mock = (ddbLibMock as any).__mockSend;
const mockFrom: jest.Mock = (ddbLibMock as any).__mockFrom;

// ─── DocumentClient configuration ──────────────────────────────────────────

describe('DynamoDBDocumentClient configuration', () => {
  it('creates the DocumentClient with removeUndefinedValues: true in marshallOptions', () => {
    // The module is evaluated once on import; from() is called at module init time.
    // We assert the second argument (translateConfig) passed to from().
    expect(mockFrom).toHaveBeenCalled();
    const [, translateConfig] = mockFrom.mock.calls[0];
    expect(translateConfig).toEqual({
      marshallOptions: { removeUndefinedValues: true },
    });
  });

  it('marshallOptions.removeUndefinedValues is exactly true, not a falsy value', () => {
    const [, translateConfig] = mockFrom.mock.calls[0];
    expect(translateConfig.marshallOptions.removeUndefinedValues).toBe(true);
  });
});

describe('parseListing (via getListing)', () => {
  beforeEach(() => {
    mockSend.mockReset();
  });

  it('strips L# prefix from PK to produce id', async () => {
    mockSend.mockResolvedValueOnce({
      Item: {
        PK: 'L#abc123',
        SK: 'META',
        name: 'Test Biz',
        slug: 'test-biz',
        entityType: 'business',
        status: 'active',
        rating: '4.5',
        totalReviews: '10',
        createdAt: '2026-01-01T00:00:00Z',
      },
    });
    const result = await getListing('abc123');
    expect(result).not.toBeNull();
    expect(result!.id).toBe('abc123');
  });

  it('converts rating and totalReviews strings to numbers', async () => {
    mockSend.mockResolvedValueOnce({
      Item: {
        PK: 'L#id1',
        SK: 'META',
        name: 'Cafe',
        slug: 'cafe',
        entityType: 'business',
        status: 'active',
        rating: '3.7',
        totalReviews: '42',
        createdAt: '2026-01-01T00:00:00Z',
      },
    });
    const result = await getListing('id1');
    expect(result!.rating).toBe(3.7);
    expect(result!.totalReviews).toBe(42);
  });

  it('defaults rating and totalReviews to 0 when absent', async () => {
    mockSend.mockResolvedValueOnce({
      Item: {
        PK: 'L#id2',
        SK: 'META',
        name: 'New Place',
        slug: 'new-place',
        entityType: 'business',
        status: 'active',
        createdAt: '2026-01-01T00:00:00Z',
        // rating and totalReviews intentionally omitted
      },
    });
    const result = await getListing('id2');
    expect(result!.rating).toBe(0);
    expect(result!.totalReviews).toBe(0);
  });

  it('converts latitude and longitude strings to numbers when present', async () => {
    mockSend.mockResolvedValueOnce({
      Item: {
        PK: 'L#id3',
        SK: 'META',
        name: 'Located Biz',
        slug: 'located-biz',
        entityType: 'business',
        status: 'active',
        rating: '0',
        totalReviews: '0',
        createdAt: '2026-01-01T00:00:00Z',
        latitude: '41.0082',
        longitude: '28.9784',
      },
    });
    const result = await getListing('id3');
    expect(result!.latitude).toBe(41.0082);
    expect(result!.longitude).toBe(28.9784);
  });

  it('leaves latitude and longitude undefined when absent', async () => {
    mockSend.mockResolvedValueOnce({
      Item: {
        PK: 'L#id4',
        SK: 'META',
        name: 'No Coords',
        slug: 'no-coords',
        entityType: 'business',
        status: 'active',
        rating: '0',
        totalReviews: '0',
        createdAt: '2026-01-01T00:00:00Z',
      },
    });
    const result = await getListing('id4');
    expect(result!.latitude).toBeUndefined();
    expect(result!.longitude).toBeUndefined();
  });

  it('strips L# prefix from parentId when present', async () => {
    mockSend.mockResolvedValueOnce({
      Item: {
        PK: 'L#child1',
        SK: 'META',
        name: 'Branch',
        slug: 'branch',
        entityType: 'business',
        status: 'active',
        rating: '0',
        totalReviews: '0',
        createdAt: '2026-01-01T00:00:00Z',
        parentId: 'L#parent99',
      },
    });
    const result = await getListing('child1');
    expect(result!.parentId).toBe('parent99');
  });

  it('leaves parentId undefined when not present in raw item', async () => {
    mockSend.mockResolvedValueOnce({
      Item: {
        PK: 'L#standalone',
        SK: 'META',
        name: 'Standalone',
        slug: 'standalone',
        entityType: 'business',
        status: 'active',
        rating: '0',
        totalReviews: '0',
        createdAt: '2026-01-01T00:00:00Z',
      },
    });
    const result = await getListing('standalone');
    expect(result!.parentId).toBeUndefined();
  });

  it('returns null when DynamoDB item is not found', async () => {
    mockSend.mockResolvedValueOnce({ Item: undefined });
    const result = await getListing('nonexistent');
    expect(result).toBeNull();
  });

  it('propagates DynamoDB SDK errors', async () => {
    mockSend.mockRejectedValueOnce(new Error('DynamoDB unavailable'));
    await expect(getListing('any')).rejects.toThrow('DynamoDB unavailable');
  });

  it('sends GetCommand with Key PK=L#<id> and SK=META', async () => {
    mockSend.mockResolvedValueOnce({ Item: undefined });
    await getListing('myid');
    // GetCommand constructor receives the input; assert its Key field
    const GetCommand = (ddbLibMock as any).GetCommand;
    const lastCallArgs = GetCommand.mock.calls[GetCommand.mock.calls.length - 1][0];
    expect(lastCallArgs.Key).toEqual({ PK: 'L#myid', SK: 'META' });
  });

  it('sends GetCommand with Key PK prefix L# exactly (not an empty string)', async () => {
    mockSend.mockResolvedValueOnce({ Item: undefined });
    await getListing('abc');
    const GetCommand = (ddbLibMock as any).GetCommand;
    const lastCallArgs = GetCommand.mock.calls[GetCommand.mock.calls.length - 1][0];
    expect(lastCallArgs.Key.PK).toBe('L#abc');
    expect(lastCallArgs.Key.SK).toBe('META');
  });
});

describe('parseCard (via browseByCategory)', () => {
  beforeEach(() => {
    mockSend.mockReset();
  });

  it('strips L# prefix from PK to produce card id', async () => {
    mockSend.mockResolvedValueOnce({
      Items: [
        {
          PK: 'L#card1',
          name: 'Card Biz',
          slug: 'card-biz',
          entityType: 'business',
          cityCode: '34',
          rating: '4.0',
          totalReviews: '5',
        },
      ],
    });
    const { items } = await browseByCategory('restaurant');
    expect(items[0].id).toBe('card1');
  });

  it('maps name, slug, entityType, cityCode correctly', async () => {
    mockSend.mockResolvedValueOnce({
      Items: [
        {
          PK: 'L#card2',
          name: 'Istanbul Kebap',
          slug: 'istanbul-kebap',
          entityType: 'business',
          cityCode: '34',
          rating: '4.2',
          totalReviews: '88',
        },
      ],
    });
    const { items } = await browseByCategory('food');
    expect(items[0].name).toBe('Istanbul Kebap');
    expect(items[0].slug).toBe('istanbul-kebap');
    expect(items[0].entityType).toBe('business');
    expect(items[0].cityCode).toBe('34');
  });

  it('converts rating and totalReviews strings to numbers', async () => {
    mockSend.mockResolvedValueOnce({
      Items: [
        {
          PK: 'L#card3',
          name: 'Rated Place',
          slug: 'rated-place',
          entityType: 'business',
          rating: '3.9',
          totalReviews: '21',
        },
      ],
    });
    const { items } = await browseByCategory('any');
    expect(items[0].rating).toBe(3.9);
    expect(items[0].totalReviews).toBe(21);
  });

  it('defaults rating and totalReviews to 0 when absent from raw item', async () => {
    mockSend.mockResolvedValueOnce({
      Items: [
        {
          PK: 'L#card4',
          name: 'Unrated',
          slug: 'unrated',
          entityType: 'business',
        },
      ],
    });
    const { items } = await browseByCategory('any');
    expect(items[0].rating).toBe(0);
    expect(items[0].totalReviews).toBe(0);
  });

  it('passes through photos array as-is', async () => {
    const photos = [{ url: 'https://example.com/img.jpg', primary: true }];
    mockSend.mockResolvedValueOnce({
      Items: [
        {
          PK: 'L#card5',
          name: 'Photo Biz',
          slug: 'photo-biz',
          entityType: 'business',
          rating: '0',
          totalReviews: '0',
          photos,
        },
      ],
    });
    const { items } = await browseByCategory('any');
    expect(items[0].photos).toEqual(photos);
  });

  it('leaves photos undefined when not present in raw item', async () => {
    mockSend.mockResolvedValueOnce({
      Items: [
        {
          PK: 'L#card6',
          name: 'No Photos',
          slug: 'no-photos',
          entityType: 'business',
          rating: '0',
          totalReviews: '0',
        },
      ],
    });
    const { items } = await browseByCategory('any');
    expect(items[0].photos).toBeUndefined();
  });

  it('returns empty array and no lastKey when Items is empty', async () => {
    mockSend.mockResolvedValueOnce({ Items: [] });
    const { items, lastKey } = await browseByCategory('empty-cat');
    expect(items).toHaveLength(0);
    expect(lastKey).toBeUndefined();
  });

  it('returns lastKey when DynamoDB returns LastEvaluatedKey', async () => {
    const nextKey = { PK: 'L#next', GSI1SK: 'R#4.0#L#next' };
    mockSend.mockResolvedValueOnce({
      Items: [],
      LastEvaluatedKey: nextKey,
    });
    const { lastKey } = await browseByCategory('any');
    expect(lastKey).toEqual(nextKey);
  });

  it('sends QueryCommand to GSI1-category index with correct KeyConditionExpression', async () => {
    mockSend.mockResolvedValueOnce({ Items: [] });
    await browseByCategory('restaurant');
    const QueryCommand = (ddbLibMock as any).QueryCommand;
    const lastCallArgs = QueryCommand.mock.calls[QueryCommand.mock.calls.length - 1][0];
    expect(lastCallArgs.IndexName).toBe('GSI1-category');
    expect(lastCallArgs.KeyConditionExpression).toBe('GSI1PK = :pk');
  });

  it('sends QueryCommand with ExpressionAttributeValues :pk = CAT#<slug>', async () => {
    mockSend.mockResolvedValueOnce({ Items: [] });
    await browseByCategory('food');
    const QueryCommand = (ddbLibMock as any).QueryCommand;
    const lastCallArgs = QueryCommand.mock.calls[QueryCommand.mock.calls.length - 1][0];
    expect(lastCallArgs.ExpressionAttributeValues).toEqual({ ':pk': 'CAT#food' });
  });
});
