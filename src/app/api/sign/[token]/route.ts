import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  signers,
  signatureFields,
  documents,
  envelopes,
  auditEvents,
} from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { checkAndCompleteEnvelope } from "@/lib/services/completion";
import { z } from "zod";

async function findActiveSigner(token: string) {
  const [row] = await db
    .select({ signer: signers, envelope: envelopes })
    .from(signers)
    .innerJoin(envelopes, eq(signers.envelopeId, envelopes.id))
    .where(eq(signers.token, token))
    .limit(1);
  return row ?? null;
}

/** GET /api/sign/[token] — returns signing context (no auth required) */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const row = await findActiveSigner(token);

    if (!row)
      return NextResponse.json({ error: "Invalid signing link" }, { status: 404 });

    const { signer, envelope } = row;

    if (!["SENT", "DELIVERED", "VIEWED"].includes(envelope.status))
      return NextResponse.json(
        { error: "This document is no longer available for signing" },
        { status: 410 }
      );

    if (signer.status === "SIGNED")
      return NextResponse.json({ error: "Already signed" }, { status: 409 });

    if (signer.status === "DECLINED")
      return NextResponse.json({ error: "Signing was declined" }, { status: 410 });

    // Mark as VIEWED if not already
    if (signer.status === "SENT" || signer.status === "PENDING") {
      await db
        .update(signers)
        .set({ status: "VIEWED", viewedAt: new Date() })
        .where(eq(signers.id, signer.id));

      await db.insert(auditEvents).values({
        envelopeId: envelope.id,
        event: "DOCUMENT_VIEWED",
        actor: signer.email,
        meta: { signerId: signer.id },
      });
    }

    // Get the document
    const [doc] = await db
      .select()
      .from(documents)
      .where(eq(documents.envelopeId, envelope.id))
      .limit(1);

    if (!doc)
      return NextResponse.json({ error: "No document found" }, { status: 404 });

    // Get fields assigned to this signer
    const fields = await db
      .select()
      .from(signatureFields)
      .where(
        and(
          eq(signatureFields.documentId, doc.id),
          eq(signatureFields.signerId, signer.id)
        )
      );

    return NextResponse.json({
      envelope: { id: envelope.id, title: envelope.title, message: envelope.message },
      signer: {
        id: signer.id,
        name: signer.name,
        email: signer.email,
        status: signer.status,
      },
      document: {
        id: doc.id,
        filename: doc.filename,
        pageCount: doc.pageCount,
      },
      fields: fields.map((f) => ({
        id: f.id,
        type: f.type,
        pageNumber: f.pageNumber,
        x: Number(f.x),
        y: Number(f.y),
        width: Number(f.width),
        height: Number(f.height),
        required: f.required,
        value: f.value,
      })),
    });
  } catch (err) {
    console.error("[GET /api/sign/[token]]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

const submitSchema = z.object({
  fieldValues: z.array(
    z.object({
      fieldId: z.string().uuid(),
      value: z.string(),
    })
  ),
});

/** POST /api/sign/[token] — submit signed field values */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const row = await findActiveSigner(token);

    if (!row)
      return NextResponse.json({ error: "Invalid signing link" }, { status: 404 });

    const { signer, envelope } = row;

    if (signer.status === "SIGNED")
      return NextResponse.json({ error: "Already signed" }, { status: 409 });

    if (!["SENT", "DELIVERED", "VIEWED"].includes(envelope.status))
      return NextResponse.json(
        { error: "This document is no longer available for signing" },
        { status: 410 }
      );

    const body = await req.json();
    const parsed = submitSchema.safeParse(body);
    if (!parsed.success)
      return NextResponse.json(
        { error: "Validation error", details: parsed.error.flatten() },
        { status: 400 }
      );

    // Get document to validate field ownership
    const [doc] = await db
      .select()
      .from(documents)
      .where(eq(documents.envelopeId, envelope.id))
      .limit(1);

    if (!doc)
      return NextResponse.json({ error: "No document found" }, { status: 404 });

    // Validate required fields are all submitted
    const signerFields = await db
      .select()
      .from(signatureFields)
      .where(
        and(
          eq(signatureFields.documentId, doc.id),
          eq(signatureFields.signerId, signer.id)
        )
      );

    const submittedMap = new Map(
      parsed.data.fieldValues.map((fv) => [fv.fieldId, fv.value])
    );

    const missingRequired = signerFields
      .filter((f) => f.required && !submittedMap.get(f.id))
      .map((f) => f.id);

    if (missingRequired.length > 0)
      return NextResponse.json(
        { error: "Missing required fields", fields: missingRequired },
        { status: 422 }
      );

    // Save field values
    for (const { fieldId, value } of parsed.data.fieldValues) {
      // Ensure field belongs to this signer + document (security check)
      const field = signerFields.find((f) => f.id === fieldId);
      if (!field) continue;
      await db
        .update(signatureFields)
        .set({ value })
        .where(eq(signatureFields.id, fieldId));
    }

    // Mark signer as signed
    await db
      .update(signers)
      .set({ status: "SIGNED", signedAt: new Date() })
      .where(eq(signers.id, signer.id));

    await db.insert(auditEvents).values({
      envelopeId: envelope.id,
      event: "DOCUMENT_SIGNED",
      actor: signer.email,
      meta: { signerId: signer.id, fieldCount: parsed.data.fieldValues.length },
    });

    // Check if all signers are done and trigger completion
    await checkAndCompleteEnvelope(envelope.id);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[POST /api/sign/[token]]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/** DELETE /api/sign/[token] — decline signing */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;
    const row = await findActiveSigner(token);

    if (!row)
      return NextResponse.json({ error: "Invalid signing link" }, { status: 404 });

    const { signer, envelope } = row;

    if (signer.status === "SIGNED")
      return NextResponse.json({ error: "Already signed" }, { status: 409 });

    const body = await req.json().catch(() => ({}));
    const reason = typeof body.reason === "string" ? body.reason : undefined;

    await db
      .update(signers)
      .set({ status: "DECLINED" })
      .where(eq(signers.id, signer.id));

    await db.insert(auditEvents).values({
      envelopeId: envelope.id,
      event: "DOCUMENT_DECLINED",
      actor: signer.email,
      meta: { signerId: signer.id, reason },
    });

    await checkAndCompleteEnvelope(envelope.id);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE /api/sign/[token]]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

