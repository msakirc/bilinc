import { NextResponse } from "next/server";
import * as catalog from "@/lib/catalog/dynamodb";
import { listingFromCatalog } from "@/lib/catalog/mappers";

// Server-side single-listing detail via the DynamoDB catalog. 404/null when the
// listing is missing or an error occurs (preserves the not-found contract).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const listing = await catalog.getListing(id);
    if (!listing) return NextResponse.json(null, { status: 404 });
    return NextResponse.json(listingFromCatalog(listing));
  } catch (err) {
    console.error("[api/catalog/listing]", err);
    return NextResponse.json(null, { status: 404 });
  }
}
