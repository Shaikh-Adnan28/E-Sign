import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { processBulkSendBatch } from "@/lib/services/bulk-send";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const result = await processBulkSendBatch(id, session.user.id);

    return NextResponse.json({ success: true, result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to process bulk send batch";
    console.error("[POST /api/bulk-send/[id]/start]", msg);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
