import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { documents } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [doc] = await db.select().from(documents).where(eq(documents.id, id));
  if (!doc) return new NextResponse('Not found', { status: 404 });
  
  // Normally return the stamped PDF from S3. Here we just return 404 or a dummy response
  return new NextResponse('PDF stream would be here', { status: 200 });
}
