import { NextResponse } from "next/server";
import * as catalog from "@/lib/catalog/dynamodb";
import { listingFromCard } from "@/lib/catalog/mappers";

// Server-side "recently added" listings by entity type via the DynamoDB
// catalog. Backs both trending and recently-added homepage rails. Returns
// mapped web Listing[].
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") ?? "business";
    const limit = Number(searchParams.get("limit") ?? "5") || 5;
    const cards = await catalog.getRecentByType(type, limit);
    return NextResponse.json(cards.map(listingFromCard));
  } catch (err) {
    console.error("[api/catalog/recent]", err);
    return NextResponse.json([], { status: 200 });
  }
}
