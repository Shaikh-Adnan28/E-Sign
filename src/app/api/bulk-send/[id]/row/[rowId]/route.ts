import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { updateBulkSendRowAndRetry } from "@/lib/services/bulk-send";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; rowId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, rowId } = await params;
    const body = await req.json();

    if (!body.recipientData || typeof body.recipientData !== "object") {
      return NextResponse.json({ error: "recipientData is required" }, { status: 400 });
    }

    const result = await updateBulkSendRowAndRetry({
      batchId: id,
      rowId,
      ownerId: session.user.id,
      recipientData: body.recipientData,
      retryNow: Boolean(body.retryNow),
    });

    return NextResponse.json({ success: true, result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to update row";
    console.error("[PATCH /api/bulk-send/[id]/row/[rowId]]", msg);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
