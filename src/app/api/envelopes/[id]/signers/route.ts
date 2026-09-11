import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { signers } from '@/lib/db/schema';
import { auth } from '@/lib/auth';
import { generateToken } from '@/lib/tokens';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });
  
  const { id } = await params;
  const body = await req.json();
  const token = generateToken();
  
  const [signer] = await db.insert(signers).values({
    envelopeId: id,
    email: body.email,
    name: body.name,
    token: token
  }).returning();
  
  return NextResponse.json(signer);
}
