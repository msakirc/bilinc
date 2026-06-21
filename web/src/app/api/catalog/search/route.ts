import { NextResponse } from "next/server";
import * as proxy from "@/lib/search/proxy";
import { searchResultFromProxy } from "@/lib/catalog/mappers";

// Server-side catalog search. Runs the Cognito-unauth SigV4 → Lambda proxy work
// on the Node runtime (the AWS SDK never ships to the browser, and the Lambda
// Function URL has no browser CORS). Returns ALREADY-MAPPED web SearchResult[].
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      query?: string;
      cityCode?: string;
      entityType?: string;
      categorySlug?: string;
      limit?: number;
      offset?: number;
    };
    const results = await proxy.searchListings(body.query ?? "", {
      cityCode: body.cityCode,
      entityType: body.entityType,
      categorySlug: body.categorySlug,
      limit: body.limit,
      offset: body.offset,
    });
    return NextResponse.json(results.map(searchResultFromProxy));
  } catch (err) {
    console.error("[api/catalog/search]", err);
    // Degrade gracefully — the old Supabase path also swallowed errors to empty.
    return NextResponse.json([], { status: 200 });
  }
}
