import { db } from "@/lib/db";
import {
  envelopes,
  signers,
  documents,
  signatureFields,
  auditEvents,
} from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { stampSignedDocument } from "@/lib/pdf";

import { sendSigningEmail } from "@/lib/email";

export async function checkAndCompleteEnvelope(
  envelopeId: string
): Promise<void> {
  const [envelope] = await db
    .select()
    .from(envelopes)
    .where(eq(envelopes.id, envelopeId))
    .limit(1);

  if (!envelope) return;

  const allSigners = await db
    .select()
    .from(signers)
    .where(eq(signers.envelopeId, envelopeId))
    .orderBy(signers.order);

  if (allSigners.length === 0) return;

  // 1. Decline check
  const hasDeclined = allSigners.some((s) => s.status === "DECLINED");
  if (hasDeclined) {
    await db
      .update(envelopes)
      .set({ status: "DECLINED", updatedAt: new Date() })
      .where(eq(envelopes.id, envelopeId));
    await db.insert(auditEvents).values({
      envelopeId,
      event: "DOCUMENT_DECLINED",
    });
    return;
  }

  // 2. Full completion check
  const allSigned = allSigners.every((s) => s.status === "SIGNED");
  if (allSigned) {
    // Stamp the PDF
    const [doc] = await db
      .select()
      .from(documents)
      .where(eq(documents.envelopeId, envelopeId))
      .limit(1);

    if (doc) {
      const fields = await db
        .select()
        .from(signatureFields)
        .where(eq(signatureFields.documentId, doc.id));

      const fieldsToStamp = fields
        .filter((f) => !!f.value)
        .map((f) => ({
          type: f.type,
          pageNumber: f.pageNumber,
          x: Number(f.x),
          y: Number(f.y),
          width: Number(f.width),
          height: Number(f.height),
          value: f.value!,
        }));

      try {
        await stampSignedDocument(doc.storageKey, fieldsToStamp);
      } catch (err) {
        console.error("[completion] PDF stamping failed:", err);
      }
    }

    await db
      .update(envelopes)
      .set({ status: "COMPLETED", updatedAt: new Date() })
      .where(eq(envelopes.id, envelopeId));

    await db.insert(auditEvents).values({
      envelopeId,
      event: "DOCUMENT_COMPLETED",
      meta: { signerCount: allSigners.length },
    });
    return;
  }

  // 3. Partial completion / Sequential activation for next signer order
  const signedCount = allSigners.filter((s) => s.status === "SIGNED").length;
  if (signedCount > 0) {
    await db
      .update(envelopes)
      .set({ status: "PARTIALLY_SIGNED", updatedAt: new Date() })
      .where(eq(envelopes.id, envelopeId));
  }

  // Find lowest order of signers who are still PENDING
  const pendingOrders = allSigners
    .filter((s) => s.status === "PENDING")
    .map((s) => s.order ?? 1);

  if (pendingOrders.length > 0) {
    const nextOrder = Math.min(...pendingOrders);

    // Check if ALL signers with order < nextOrder are SIGNED
    const lowerOrderSigners = allSigners.filter(
      (s) => (s.order ?? 1) < nextOrder
    );

    const canActivateNext = lowerOrderSigners.every(
      (s) => s.status === "SIGNED"
    );

    if (canActivateNext) {
      const nextSignersToActivate = allSigners.filter(
        (s) => (s.order ?? 1) === nextOrder && s.status === "PENDING"
      );

      for (const signer of nextSignersToActivate) {
        await db
          .update(signers)
          .set({ status: "SENT" })
          .where(eq(signers.id, signer.id));

        await sendSigningEmail({
          to: signer.email,
          signerName: signer.name ?? signer.email,
          senderName: "ESign Sender",
          documentTitle: envelope.title,
          token: signer.token,
        });
      }
    }
  }
}

