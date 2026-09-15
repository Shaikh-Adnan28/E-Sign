import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { bulkSendBatches, bulkSendRows, templates } from "@/lib/db/schema";
import { eq, and, asc } from "drizzle-orm";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const [batchRecord] = await db
      .select({
        batch: bulkSendBatches,
        templateName: templates.name,
      })
      .from(bulkSendBatches)
      .leftJoin(templates, eq(bulkSendBatches.templateId, templates.id))
      .where(and(eq(bulkSendBatches.id, id), eq(bulkSendBatches.ownerId, session.user.id)))
      .limit(1);

    if (!batchRecord) {
      return NextResponse.json({ error: "Batch not found" }, { status: 404 });
    }

    const rows = await db
      .select()
      .from(bulkSendRows)
      .where(eq(bulkSendRows.batchId, id))
      .orderBy(asc(bulkSendRows.rowNumber));

    return NextResponse.json({
      batch: {
        ...batchRecord.batch,
        templateName: batchRecord.templateName ?? "Deleted Template",
      },
      rows,
    });
  } catch (err) {
    console.error("[GET /api/bulk-send/[id]]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
