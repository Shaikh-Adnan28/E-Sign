import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { envelopes, signers, documents, auditEvents } from "@/lib/db/schema";
import { auth } from "@/lib/auth";
import { eq, and } from "drizzle-orm";
import { sendSigningEmail } from "@/lib/email";

interface SendRequestBody {
  reminderEnabled?: boolean;
  reminderFirstAfterDays?: number;
  reminderEveryDays?: number;
  reminderMessage?: string | null;
  expirationDays?: number;
  expirationWarningDays?: number;
  expiresAt?: string;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;

    let body: SendRequestBody = {};
    try {
      body = (await req.json()) as SendRequestBody;
    } catch {
      // Body is optional
    }

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
      .where(eq(signers.envelopeId, id))
      .orderBy(signers.order);
    if (envelopeSigners.length === 0)
      return NextResponse.json(
        { error: "Add at least one recipient before sending" },
        { status: 422 }
      );

    const now = new Date();
    const reminderEnabled = body.reminderEnabled ?? envelope.reminderEnabled ?? false;
    const reminderFirstAfterDays = body.reminderFirstAfterDays ?? envelope.reminderFirstAfterDays ?? 2;
    const reminderEveryDays = body.reminderEveryDays ?? envelope.reminderEveryDays ?? 3;
    const reminderMessage = body.reminderMessage !== undefined ? body.reminderMessage : envelope.reminderMessage;
    const expirationWarningDays = body.expirationWarningDays ?? envelope.expirationWarningDays ?? 3;

    let expiresAt: Date | null = envelope.expiresAt;
    if (body.expiresAt) {
      expiresAt = new Date(body.expiresAt);
    } else if (typeof body.expirationDays === "number") {
      expiresAt = new Date(now.getTime() + body.expirationDays * 24 * 60 * 60 * 1000);
    }

    let nextReminderAt: Date | null = null;
    if (reminderEnabled) {
      nextReminderAt = new Date(now.getTime() + reminderFirstAfterDays * 24 * 60 * 60 * 1000);
    }

    // Atomic update to SENT state
    const [updatedEnvelope] = await db
      .update(envelopes)
      .set({
        status: "SENT",
        reminderEnabled,
        reminderFirstAfterDays,
        reminderEveryDays,
        reminderMessage,
        nextReminderAt,
        expiresAt,
        expirationWarningDays,
        updatedAt: now,
      })
      .where(and(eq(envelopes.id, id), eq(envelopes.ownerId, session.user.id), eq(envelopes.status, "DRAFT")))
      .returning();

    if (!updatedEnvelope)
      return NextResponse.json(
        { error: "Envelope has already been sent or is not in DRAFT state" },
        { status: 409 }
      );

    // Sequential signing activation
    const orders = envelopeSigners.map((s) => s.order ?? 1);
    const minOrder = Math.min(...orders);

    const activeSigners = envelopeSigners.filter((s) => (s.order ?? 1) === minOrder);
    const senderName = session.user.name ?? session.user.email ?? "Someone";

    for (const signer of activeSigners) {
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
      meta: {
        recipientCount: envelopeSigners.length,
        activeInitialCount: activeSigners.length,
        reminderEnabled,
        expiresAt: expiresAt?.toISOString(),
      },
    });

    return NextResponse.json({ success: true, envelope: updatedEnvelope });
  } catch (err) {
    console.error("[POST /api/envelopes/[id]/send]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
