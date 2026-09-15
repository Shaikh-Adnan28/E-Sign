import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { bulkSendBatches, templates } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { createBulkSendBatch, RoleMappingConfig, BatchReminderConfig } from "@/lib/services/bulk-send";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const batches = await db
      .select({
        batch: bulkSendBatches,
        templateName: templates.name,
      })
      .from(bulkSendBatches)
      .leftJoin(templates, eq(bulkSendBatches.templateId, templates.id))
      .where(eq(bulkSendBatches.ownerId, session.user.id))
      .orderBy(desc(bulkSendBatches.createdAt));

    return NextResponse.json({
      batches: batches.map(({ batch, templateName }) => ({
        ...batch,
        templateName: templateName ?? "Deleted Template",
      })),
    });
  } catch (err) {
    console.error("[GET /api/bulk-send]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();

    const {
      templateId,
      name,
      csvFilename,
      csvContent,
      roleMapping,
      reminderConfig,
    } = body as {
      templateId: string;
      name: string;
      csvFilename: string;
      csvContent: string;
      roleMapping: RoleMappingConfig;
      reminderConfig?: BatchReminderConfig;
    };

    if (!templateId || !name || !csvFilename || !csvContent || !roleMapping) {
      return NextResponse.json(
        { error: "Missing required fields: templateId, name, csvFilename, csvContent, roleMapping" },
        { status: 400 }
      );
    }

    const batch = await createBulkSendBatch({
      ownerId: session.user.id,
      templateId,
      name,
      csvFilename,
      csvContent,
      roleMapping,
      reminderConfig,
    });

    return NextResponse.json({ success: true, batch }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to create bulk send batch";
    console.error("[POST /api/bulk-send]", msg);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
