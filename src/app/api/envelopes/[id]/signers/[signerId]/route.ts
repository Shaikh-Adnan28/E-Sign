import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { signers, envelopes, auditEvents } from "@/lib/db/schema";
import { auth } from "@/lib/auth";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  order: z.number().int().min(0).optional(),
});

async function verifySignerOwner(signerId: string, userId: string) {
  const [row] = await db
    .select({ signer: signers, envelope: envelopes })
    .from(signers)
    .innerJoin(envelopes, eq(signers.envelopeId, envelopes.id))
    .where(and(eq(signers.id, signerId), eq(envelopes.ownerId, userId)))
    .limit(1);
  return row ?? null;
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; signerId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { signerId } = await params;
    const row = await verifySignerOwner(signerId, session.user.id);
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (row.signer.status !== "PENDING")
      return NextResponse.json(
        { error: "Cannot edit a signer that has already been sent a request" },
        { status: 409 }
      );

    const body = await req.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success)
      return NextResponse.json(
        { error: "Validation error", details: parsed.error.flatten() },
        { status: 400 }
      );

    const [updated] = await db
      .update(signers)
      .set(parsed.data)
      .where(eq(signers.id, signerId))
      .returning();

    await db.insert(auditEvents).values({
      envelopeId: row.envelope.id,
      event: "RECIPIENT_UPDATED",
      actor: session.user.email ?? session.user.id,
      meta: { signerId, updates: parsed.data },
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error("[PATCH signers/[signerId]]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; signerId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { signerId } = await params;
    const row = await verifySignerOwner(signerId, session.user.id);
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (row.signer.status !== "PENDING")
      return NextResponse.json(
        { error: "Cannot remove a signer who has already been notified" },
        { status: 409 }
      );

    await db.delete(signers).where(eq(signers.id, signerId));

    await db.insert(auditEvents).values({
      envelopeId: row.envelope.id,
      event: "RECIPIENT_REMOVED",
      actor: session.user.email ?? session.user.id,
      meta: { signerId, email: row.signer.email },
    });

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error("[DELETE signers/[signerId]]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

