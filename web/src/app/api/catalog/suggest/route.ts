import { NextResponse } from "next/server";
import * as proxy from "@/lib/search/proxy";
import { suggestionFromProxy } from "@/lib/catalog/mappers";

// Server-side autocomplete suggestions via the search proxy. Returns mapped
// web SearchSuggestion[].
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      query?: string;
      limit?: number;
    };
    const results = await proxy.searchSuggestions(body.query ?? "", body.limit ?? 10);
    return NextResponse.json(results.map(suggestionFromProxy));
  } catch (err) {
    console.error("[api/catalog/suggest]", err);
    return NextResponse.json([], { status: 200 });
  }
}
