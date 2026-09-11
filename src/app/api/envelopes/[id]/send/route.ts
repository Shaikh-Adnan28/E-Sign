import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { envelopes, auditEvents, signers } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { emailProvider } from '@/lib/email';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });
  
  const { id } = await params;
  
  await db.update(envelopes).set({ status: 'SENT' }).where(eq(envelopes.id, id));
  await db.insert(auditEvents).values({
    envelopeId: id,
    event: 'ENVELOPE_SENT'
  });

  const envelopeSigners = await db.select().from(signers).where(eq(signers.envelopeId, id));
  for (const signer of envelopeSigners) {
    await emailProvider.sendEmail(signer.email, 'Document to sign', `Please sign: http://localhost:3000/sign/${signer.token}`);
    await db.update(signers).set({ status: 'SENT' }).where(eq(signers.id, signer.id));
  }
  
  return NextResponse.json({ success: true });
}
