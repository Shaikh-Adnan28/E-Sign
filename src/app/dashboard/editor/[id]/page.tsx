import EditorClient from './EditorClient';
import { db } from '@/lib/db';
import { envelopes, documents, signatureFields, signers } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { auth } from '@/lib/auth';

export default async function EditorPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return notFound();
  
  const { id } = await params;
  
  const [envelope] = await db.select().from(envelopes).where(eq(envelopes.id, id));
  if (!envelope || envelope.ownerId !== session.user.id) return notFound();
  
  const envelopeSigners = await db.select().from(signers).where(eq(signers.envelopeId, id));
  const envelopeDocuments = await db.select().from(documents).where(eq(documents.envelopeId, id));
  
  if (!envelopeDocuments.length) return notFound();
  
  return <EditorClient envelope={envelope} signers={envelopeSigners} documents={envelopeDocuments} />;
}
