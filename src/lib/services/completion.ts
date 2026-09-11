import { db } from '@/lib/db';
import { envelopes, signers, documents, signatureFields, auditEvents } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { stampSignedDocument } from '@/lib/pdf';
import fs from 'fs';
import path from 'path';

export async function checkAndCompleteEnvelope(envelopeId: string) {
  // Check if all signers have signed
  const allSigners = await db.select().from(signers).where(eq(signers.envelopeId, envelopeId));
  
  const allSigned = allSigners.every(s => s.status === 'SIGNED' || s.status === 'DECLINED');
  
  if (!allSigned) return; // not ready yet
  
  const hasDeclined = allSigners.some(s => s.status === 'DECLINED');
  if (hasDeclined) {
     await db.update(envelopes).set({ status: 'DECLINED' }).where(eq(envelopes.id, envelopeId));
     return;
  }

  // Complete
  await db.update(envelopes).set({ status: 'COMPLETED' }).where(eq(envelopes.id, envelopeId));
  
  // Log audit
  await db.insert(auditEvents).values({
    envelopeId,
    event: 'ENVELOPE_COMPLETED',
  });

  // Stamp PDF - in a real app, we'd fetch the document from S3, stamp it, and re-upload.
  // Here we will just record completion.
}
