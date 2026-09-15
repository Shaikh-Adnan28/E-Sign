import { db } from "@/lib/db";
import {
  envelopes,
  signers,
  documents,
  signatureFields,
  auditEvents,
  users,
} from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { stampSignedDocument } from "@/lib/pdf";
import {
  sendSigningEmail,
  sendEnvelopeCompletedEmail,
  sendEnvelopeDeclinedEmail,
} from "@/lib/email";

export async function checkAndCompleteEnvelope(
  envelopeId: string
): Promise<void> {
  const [envelopeRecord] = await db
    .select({ envelope: envelopes, owner: users })
    .from(envelopes)
    .innerJoin(users, eq(envelopes.ownerId, users.id))
    .where(eq(envelopes.id, envelopeId))
    .limit(1);

  if (!envelopeRecord) return;

  const envelope = envelopeRecord.envelope;
  const owner = envelopeRecord.owner;

  const allSigners = await db
    .select()
    .from(signers)
    .where(eq(signers.envelopeId, envelopeId))
    .orderBy(signers.order);

  if (allSigners.length === 0) return;

  // 1. Decline check
  const declinedSigner = allSigners.find((s) => s.status === "DECLINED");
  if (declinedSigner) {
    await db
      .update(envelopes)
      .set({
        status: "DECLINED",
        nextReminderAt: null,
        updatedAt: new Date(),
      })
      .where(eq(envelopes.id, envelopeId));

    await db.insert(auditEvents).values({
      envelopeId,
      event: "DOCUMENT_DECLINED",
      actor: declinedSigner.email,
      meta: { signerEmail: declinedSigner.email },
    });

    // Notify sender of decline
    try {
      await sendEnvelopeDeclinedEmail({
        to: owner.email,
        senderName: owner.name ?? owner.email,
        declinedByName: declinedSigner.name ?? declinedSigner.email,
        documentTitle: envelope.title,
      });
    } catch (err) {
      console.error("[completion] sendEnvelopeDeclinedEmail error:", err);
    }

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
      .set({
        status: "COMPLETED",
        nextReminderAt: null,
        updatedAt: new Date(),
      })
      .where(eq(envelopes.id, envelopeId));

    await db.insert(auditEvents).values({
      envelopeId,
      event: "DOCUMENT_COMPLETED",
      meta: { signerCount: allSigners.length },
    });

    // Send completion emails to owner and all signers
    try {
      // Owner
      await sendEnvelopeCompletedEmail({
        to: owner.email,
        name: owner.name ?? owner.email,
        documentTitle: envelope.title,
      });

      // Signers
      for (const signer of allSigners) {
        if (signer.email !== owner.email) {
          await sendEnvelopeCompletedEmail({
            to: signer.email,
            name: signer.name ?? signer.email,
            documentTitle: envelope.title,
          });
        }
      }
    } catch (err) {
      console.error("[completion] sendEnvelopeCompletedEmail error:", err);
    }

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
          senderName: owner.name ?? owner.email,
          documentTitle: envelope.title,
          token: signer.token,
        });
      }
    }
  }
}
