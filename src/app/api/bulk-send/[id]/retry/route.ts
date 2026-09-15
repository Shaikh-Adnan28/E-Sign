import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { retryFailedBulkSendRows } from "@/lib/services/bulk-send";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    let body: { rowIds?: string[] } = {};
    try {
      body = await req.json();
    } catch {
      // Optional body
    }

    const result = await retryFailedBulkSendRows(id, session.user.id, body.rowIds);
    return NextResponse.json({ success: true, result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to retry bulk send rows";
    console.error("[POST /api/bulk-send/[id]/retry]", msg);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
