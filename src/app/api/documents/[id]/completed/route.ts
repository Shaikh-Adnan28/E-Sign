import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { documents, envelopes, signers } from "@/lib/db/schema";
import { auth } from "@/lib/auth";
import { eq, and } from "drizzle-orm";
import { storageProvider } from "@/lib/storage";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const url = new URL(req.url);
    const token = url.searchParams.get("token");

    const { id } = await params;

    let authorized = false;
    let row: { doc: typeof documents.$inferSelect; envelope: typeof envelopes.$inferSelect } | null = null;

    if (session?.user?.id) {
      const [ownerRow] = await db
        .select({ doc: documents, envelope: envelopes })
        .from(documents)
        .innerJoin(envelopes, eq(documents.envelopeId, envelopes.id))
        .where(and(eq(documents.id, id), eq(envelopes.ownerId, session.user.id)))
        .limit(1);
      if (ownerRow) {
        authorized = true;
        row = ownerRow;
      }
    }

    if (!authorized && token) {
      const [signerRow] = await db
        .select({ doc: documents, envelope: envelopes })
        .from(documents)
        .innerJoin(envelopes, eq(documents.envelopeId, envelopes.id))
        .innerJoin(signers, eq(signers.envelopeId, envelopes.id))
        .where(and(eq(documents.id, id), eq(signers.token, token)))
        .limit(1);
      if (signerRow) {
        authorized = true;
        row = signerRow;
      }
    }

    if (!authorized || !row) {
      return NextResponse.json({ error: "Unauthorized or document not found" }, { status: 404 });
    }

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

