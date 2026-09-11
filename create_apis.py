import os

routes = {
    "src/app/api/documents/[id]/fields/route.ts": """import { NextResponse } from 'next/server';
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
""",

    "src/app/api/documents/[id]/fields/[fieldId]/route.ts": """import { NextResponse } from 'next/server';
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
""",

    "src/app/api/envelopes/[id]/signers/route.ts": """import { NextResponse } from 'next/server';
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
""",

    "src/app/api/envelopes/[id]/signers/[signerId]/route.ts": """import { NextResponse } from 'next/server';
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
""",

    "src/app/api/envelopes/[id]/send/route.ts": """import { NextResponse } from 'next/server';
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
""",

    "src/app/api/sign/[token]/route.ts": """import { NextResponse } from 'next/server';
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
""",

    "src/app/api/documents/[id]/completed/route.ts": """import { NextResponse } from 'next/server';
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
"""
}

def ensure_dir(filepath):
    os.makedirs(os.path.dirname(filepath), exist_ok=True)

for filepath, content in routes.items():
    ensure_dir(filepath)
    with open(filepath, "w") as f:
        f.write(content)
    print(f"Wrote {filepath}")
