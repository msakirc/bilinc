import { NextResponse } from "next/server";
import * as catalog from "@/lib/catalog/dynamodb";
import { searchResultFromCard } from "@/lib/catalog/mappers";

// Server-side category browse via the DynamoDB catalog. cityCode narrows to the
// city+category index. Returns mapped web SearchResult[].
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      categorySlug?: string;
      cityCode?: string;
      limit?: number;
    };
    const limit = body.limit ?? 20;
    const categorySlug = body.categorySlug ?? "";
    const { items } = body.cityCode
      ? await catalog.browseByCityCategory(body.cityCode, categorySlug, limit)
      : await catalog.browseByCategory(categorySlug, limit);
    return NextResponse.json(items.map(searchResultFromCard));
  } catch (err) {
    console.error("[api/catalog/browse]", err);
    return NextResponse.json([], { status: 200 });
  }
}
