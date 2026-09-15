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

export async function checkAndCompleteEnvelope(
  envelopeId: string
): Promise<void> {
  const allSigners = await db
    .select()
    .from(signers)
    .where(eq(signers.envelopeId, envelopeId));

  if (allSigners.length === 0) return;

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

  const allSigned = allSigners.every((s) => s.status === "SIGNED");
  if (!allSigned) return;

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
      // Continue with completion even if stamping fails
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
}

