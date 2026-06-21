// Bilinç search proxy — thin Lambda in front of Turso.
//
// The app no longer talks to Turso directly. It POSTs {op, ...params} here.
// This function whitelists two query shapes, clamps numeric inputs, binds all
// values as Hrana typed args (never string-interpolated), and forwards to the
// Turso /v2/pipeline HTTP API using a token held only in Lambda env.
//
// Env:
//   TURSO_URL         e.g. https://bilinc-bilinc.aws-eu-west-1.turso.io
//   TURSO_AUTH_TOKEN  read-only Turso DB token (NEVER ships in the app bundle)

const TURSO_URL = process.env.TURSO_URL || '';
const TURSO_AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN || '';

const MAX_Q = 64;
const MAX_LIMIT = 50;
const MAX_OFFSET = 1000;

// ─── Hrana typed-arg encoding (raw values -> HTTP 400) ──────────────
function tursoArg(v) {
  if (v === null || v === undefined) return { type: 'null', value: null };
  if (typeof v === 'number') {
    return Number.isInteger(v)
      ? { type: 'integer', value: String(v) }
      : { type: 'float', value: String(v) };
  }
  return { type: 'text', value: String(v) };
}

async function tursoQuery(sql, args) {
  const resp = await fetch(`${TURSO_URL}/v2/pipeline`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TURSO_AUTH_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      requests: [
        { type: 'execute', stmt: { sql, args: args.map(tursoArg) } },
        { type: 'close' },
      ],
    }),
  });
  if (!resp.ok) {
    throw new Error(`Turso error: ${resp.status} ${resp.statusText}`);
  }
  const data = await resp.json();
  const result = data.results?.[0]?.response?.result;
  if (!result?.rows) return [];
  const cols = result.cols.map((c) => c.name);
  return result.rows.map((row) => {
    const obj = {};
    row.forEach((cell, i) => {
      obj[cols[i]] = cell.value;
    });
    return obj;
  });
}

// ─── Input sanitizing ──────────────────────────────────────────────
// Strip FTS5 syntax chars so user text can never become an FTS operator.
// Keeps letters (incl. Turkish), digits, spaces. Caps length.
function cleanQuery(raw) {
  if (typeof raw !== 'string') return '';
  return raw
    .replace(/["'()*:^\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_Q);
}

function clampInt(v, lo, hi, dflt) {
  const n = Number(v);
  if (!Number.isFinite(n)) return dflt;
  return Math.min(hi, Math.max(lo, Math.trunc(n)));
}

function clampFloat(v, lo, hi, dflt) {
  const n = Number(v);
  if (!Number.isFinite(n)) return dflt;
  return Math.min(hi, Math.max(lo, n));
}

// Great-circle distance in km.
function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Optional opaque equality filters: must be a short token or null.
function cleanFilter(v) {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  if (!t || t.length > 64) return null;
  return t;
}

// ─── Query shapes ──────────────────────────────────────────────────
async function doSearch(body) {
  const q = cleanQuery(body.q);
  if (!q) return [];
  const cityCode = cleanFilter(body.cityCode);
  const entityType = cleanFilter(body.entityType);
  const categorySlug = cleanFilter(body.categorySlug);
  const limit = clampInt(body.limit, 1, MAX_LIMIT, 20);
  const offset = clampInt(body.offset, 0, MAX_OFFSET, 0);

  const rows = await tursoQuery(
    `SELECT s.id, s.name, s.entity_type, s.city_code, s.category_slug,
            s.rating, s.total_reviews, s.latitude, s.longitude, s.photo_url,
            rank
     FROM search_idx(?) idx
     JOIN listings_search s ON s.rowid = idx.rowid
     WHERE (? IS NULL OR s.city_code = ?)
       AND (? IS NULL OR s.entity_type = ?)
       AND (? IS NULL OR s.category_slug = ?)
     ORDER BY rank
     LIMIT ? OFFSET ?`,
    [q, cityCode, cityCode, entityType, entityType, categorySlug, categorySlug, limit, offset],
  );

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    entityType: r.entity_type,
    cityCode: r.city_code || undefined,
    categorySlug: r.category_slug || undefined,
    rating: Number(r.rating || 0),
    totalReviews: Number(r.total_reviews || 0),
    latitude: r.latitude != null ? Number(r.latitude) : undefined,
    longitude: r.longitude != null ? Number(r.longitude) : undefined,
    photoUrl: r.photo_url || undefined,
  }));
}

async function doSuggest(body) {
  const q = cleanQuery(body.q);
  if (!q) return [];
  const limit = clampInt(body.limit, 1, MAX_LIMIT, 10);

  const rows = await tursoQuery(
    `SELECT s.id, s.name, s.entity_type, s.category_slug
     FROM search_idx(? || '*') idx
     JOIN listings_search s ON s.rowid = idx.rowid
     LIMIT ?`,
    [q, limit],
  );

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    entityType: r.entity_type,
    categorySlug: r.category_slug || undefined,
  }));
}

// Location-based browse. The catalog lives in DynamoDB (no geo index), but the
// Turso search index already carries lat/lng — so "nearby" runs here as a
// bounding-box scan refined by haversine. Replaces the old Supabase search_nearby
// RPC, whose listings table the hybrid-DB cleanup drops.
async function doNearby(body) {
  const lat = Number(body.lat);
  const lng = Number(body.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return [];
  const radiusKm = clampFloat(body.radiusKm, 0.1, 50, 5);
  const categorySlug = cleanFilter(body.categorySlug);
  const entityType = cleanFilter(body.entityType);
  const limit = clampInt(body.limit, 1, MAX_LIMIT, 20);

  // Bounding box. 1° lat ≈ 111 km; 1° lng shrinks by cos(lat).
  const latDelta = radiusKm / 111.0;
  const cosLat = Math.abs(Math.cos((lat * Math.PI) / 180)) || 1e-6;
  const lngDelta = radiusKm / (111.0 * cosLat);
  const minLat = lat - latDelta;
  const maxLat = lat + latDelta;
  const minLng = lng - lngDelta;
  const maxLng = lng + lngDelta;
  // Over-fetch candidates ordered by planar distance, then refine in JS.
  const candidates = Math.min(MAX_LIMIT, limit * 4);

  const rows = await tursoQuery(
    `SELECT s.id, s.name, s.entity_type, s.city_code, s.category_slug,
            s.rating, s.total_reviews, s.latitude, s.longitude, s.photo_url
     FROM listings_search s
     WHERE s.latitude BETWEEN ? AND ?
       AND s.longitude BETWEEN ? AND ?
       AND (? IS NULL OR s.category_slug = ?)
       AND (? IS NULL OR s.entity_type = ?)
     ORDER BY ((s.latitude - ?) * (s.latitude - ?))
            + ((s.longitude - ?) * (s.longitude - ?))
     LIMIT ?`,
    [minLat, maxLat, minLng, maxLng,
     categorySlug, categorySlug, entityType, entityType,
     lat, lat, lng, lng, candidates],
  );

  return rows
    .map((r) => {
      const rlat = r.latitude != null ? Number(r.latitude) : undefined;
      const rlng = r.longitude != null ? Number(r.longitude) : undefined;
      return {
        id: r.id,
        name: r.name,
        entityType: r.entity_type,
        cityCode: r.city_code || undefined,
        categorySlug: r.category_slug || undefined,
        rating: Number(r.rating || 0),
        totalReviews: Number(r.total_reviews || 0),
        latitude: rlat,
        longitude: rlng,
        photoUrl: r.photo_url || undefined,
        distanceKm:
          rlat != null && rlng != null
            ? Math.round(haversineKm(lat, lng, rlat, rlng) * 10) / 10
            : undefined,
      };
    })
    .filter((r) => r.distanceKm == null || r.distanceKm <= radiusKm)
    .sort((a, b) => (a.distanceKm ?? 1e9) - (b.distanceKm ?? 1e9))
    .slice(0, limit);
}

// ─── Handler (Lambda Function URL, payload format 2.0) ─────────────
const json = (status, obj) => ({
  statusCode: status,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(obj),
});

export async function handler(event) {
  const method = event?.requestContext?.http?.method || 'POST';
  if (method !== 'POST') return json(405, { error: 'method not allowed' });

  let body;
  try {
    const raw = event.isBase64Encoded
      ? Buffer.from(event.body || '', 'base64').toString('utf8')
      : event.body || '{}';
    body = JSON.parse(raw);
  } catch {
    return json(400, { error: 'invalid JSON' });
  }

  try {
    if (body.op === 'search') return json(200, { results: await doSearch(body) });
    if (body.op === 'suggest') return json(200, { results: await doSuggest(body) });
    if (body.op === 'nearby') return json(200, { results: await doNearby(body) });
    return json(400, { error: 'unknown op' });
  } catch (err) {
    return json(502, { error: 'search backend error' });
  }
}

// Export internals for local unit tests.
export const _internals = { cleanQuery, clampInt, clampFloat, cleanFilter, tursoArg, haversineKm };
