import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { signers, signatureFields } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { checkAndCompleteEnvelope } from '@/lib/services/completion';

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const body = await req.json();
  
  const [signer] = await db.select().from(signers).where(eq(signers.token, token));
  if (!signer) return new NextResponse('Not found', { status: 404 });
  
  // Update fields
  if (body.fields) {
    for (const field of body.fields) {
      await db.update(signatureFields).set({ value: field.value }).where(eq(signatureFields.id, field.id));
    }
  }
  
  // Update signer status
  await db.update(signers).set({ status: 'SIGNED', signedAt: new Date() }).where(eq(signers.id, signer.id));
  
  await checkAndCompleteEnvelope(signer.envelopeId);
  
  return NextResponse.json({ success: true });
}
