import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { signatureFields } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string, fieldId: string }> }) {
  const session = await auth();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });
  
  const { fieldId } = await params;
  await db.delete(signatureFields).where(eq(signatureFields.id, fieldId));
  
  return new NextResponse(null, { status: 204 });
}
