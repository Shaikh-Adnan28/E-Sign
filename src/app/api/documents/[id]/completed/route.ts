import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { documents, envelopes } from "@/lib/db/schema";
import { auth } from "@/lib/auth";
import { eq, and } from "drizzle-orm";
import { storageProvider } from "@/lib/storage";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;

    // id here is the document id; verify ownership through envelope
    const [row] = await db
      .select({ doc: documents, envelope: envelopes })
      .from(documents)
      .innerJoin(envelopes, eq(documents.envelopeId, envelopes.id))
      .where(and(eq(documents.id, id), eq(envelopes.ownerId, session.user.id)))
      .limit(1);

    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (row.envelope.status !== "COMPLETED")
      return NextResponse.json(
        { error: "Document is not yet completed" },
        { status: 409 }
      );

    const completedKey = row.doc.storageKey.replace(
      "/original.pdf",
      "/completed.pdf"
    );

    const exists = await storageProvider.exists(completedKey);
    if (!exists)
      return NextResponse.json(
        { error: "Completed file not yet available" },
        { status: 404 }
      );

    const fileBuffer = await storageProvider.download(completedKey);
    const filename = row.doc.filename.replace(".pdf", "-completed.pdf");

    return new Response(new Uint8Array(fileBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(fileBuffer.length),
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    console.error("[GET /api/documents/[id]/completed]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

