import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { signers } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { auth } from '@/lib/auth';

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string, signerId: string }> }) {
  const session = await auth();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });
  
  const { signerId } = await params;
  await db.delete(signers).where(eq(signers.id, signerId));
  
  return new NextResponse(null, { status: 204 });
}
