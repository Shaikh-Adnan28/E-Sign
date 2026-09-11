import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { signers, envelopes, auditEvents } from "@/lib/db/schema";
import { auth } from "@/lib/auth";
import { eq, and, asc } from "drizzle-orm";
import { generateSigningToken } from "@/lib/tokens";
import { z } from "zod";

const addSignerSchema = z.object({
  email: z.string().email(),
  name: z.string().optional(),
  order: z.number().int().min(0).optional().default(0),
});

async function verifyEnvelopeOwner(envelopeId: string, userId: string) {
  const [envelope] = await db
    .select()
    .from(envelopes)
    .where(and(eq(envelopes.id, envelopeId), eq(envelopes.ownerId, userId)))
    .limit(1);
  return envelope ?? null;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const envelope = await verifyEnvelopeOwner(id, session.user.id);
    if (!envelope)
      return NextResponse.json({ error: "Not found" }, { status: 404 });

    const rows = await db
      .select()
      .from(signers)
      .where(eq(signers.envelopeId, id))
      .orderBy(asc(signers.order));

    return NextResponse.json(rows);
  } catch (err) {
    console.error("[GET /api/envelopes/[id]/signers]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const envelope = await verifyEnvelopeOwner(id, session.user.id);
    if (!envelope)
      return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (envelope.status !== "DRAFT")
      return NextResponse.json(
        { error: "Cannot add signers to a non-draft envelope" },
        { status: 409 }
      );

    const body = await req.json();
    const parsed = addSignerSchema.safeParse(body);
    if (!parsed.success)
      return NextResponse.json(
        { error: "Validation error", details: parsed.error.flatten() },
        { status: 400 }
      );

    const { email, name, order } = parsed.data;
    const token = generateSigningToken();

    const [signer] = await db
      .insert(signers)
      .values({ envelopeId: id, email, name, token, order })
      .returning();

    await db.insert(auditEvents).values({
      envelopeId: id,
      event: "RECIPIENT_ADDED",
      actor: session.user.email ?? session.user.id,
      meta: { signerId: signer.id, email },
    });

    return NextResponse.json(signer, { status: 201 });
  } catch (err) {
    console.error("[POST /api/envelopes/[id]/signers]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

