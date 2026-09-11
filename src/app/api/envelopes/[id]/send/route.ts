import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { envelopes, signers, documents, auditEvents } from "@/lib/db/schema";
import { auth } from "@/lib/auth";
import { eq, and } from "drizzle-orm";
import { sendSigningEmail } from "@/lib/email";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;

    // Verify ownership
    const [envelope] = await db
      .select()
      .from(envelopes)
      .where(and(eq(envelopes.id, id), eq(envelopes.ownerId, session.user.id)))
      .limit(1);
    if (!envelope)
      return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (envelope.status !== "DRAFT")
      return NextResponse.json(
        { error: "Only DRAFT envelopes can be sent" },
        { status: 409 }
      );

    // Must have at least one document
    const [doc] = await db
      .select()
      .from(documents)
      .where(eq(documents.envelopeId, id))
      .limit(1);
    if (!doc)
      return NextResponse.json(
        { error: "No document attached to this envelope" },
        { status: 422 }
      );

    // Must have at least one signer
    const envelopeSigners = await db
      .select()
      .from(signers)
      .where(eq(signers.envelopeId, id));
    if (envelopeSigners.length === 0)
      return NextResponse.json(
        { error: "Add at least one recipient before sending" },
        { status: 422 }
      );

    // Update envelope status
    await db
      .update(envelopes)
      .set({ status: "SENT", updatedAt: new Date() })
      .where(eq(envelopes.id, id));

    // Update each signer and send email
    const senderName = session.user.name ?? session.user.email ?? "Someone";
    for (const signer of envelopeSigners) {
      await db
        .update(signers)
        .set({ status: "SENT" })
        .where(eq(signers.id, signer.id));

      await sendSigningEmail({
        to: signer.email,
        signerName: signer.name ?? signer.email,
        senderName,
        documentTitle: envelope.title,
        token: signer.token,
      });
    }

    // Audit
    await db.insert(auditEvents).values({
      envelopeId: id,
      event: "DOCUMENT_SENT",
      actor: session.user.email ?? session.user.id,
      meta: { recipientCount: envelopeSigners.length },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[POST /api/envelopes/[id]/send]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}



