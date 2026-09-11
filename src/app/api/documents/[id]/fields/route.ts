import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { signatureFields } from '@/lib/db/schema';
import { auth } from '@/lib/auth';

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return new NextResponse('Unauthorized', { status: 401 });
  
  const { id } = await params;
  const body = await req.json();
  
  const [field] = await db.insert(signatureFields).values({
    documentId: id,
    ...body
  }).returning();
  
  return NextResponse.json(field);
}
