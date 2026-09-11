import { db } from '@/lib/db';
import { signers, envelopes, documents } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import SignatureClient from './SignatureClient';

export default async function SignPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  
  const [signer] = await db.select().from(signers).where(eq(signers.token, token));
  if (!signer) return notFound();
  
  const [envelope] = await db.select().from(envelopes).where(eq(envelopes.id, signer.envelopeId));
  const envelopeDocuments = await db.select().from(documents).where(eq(documents.envelopeId, envelope.id));
  
  return <SignatureClient signer={signer} envelope={envelope} documents={envelopeDocuments} />;
}
