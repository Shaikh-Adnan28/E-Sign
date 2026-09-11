import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { signatureFields, documents, envelopes, auditEvents } from "@/lib/db/schema";
import { auth } from "@/lib/auth";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

const patchSchema = z.object({
  x: z.number().min(0).max(1).optional(),
  y: z.number().min(0).max(1).optional(),
  width: z.number().min(0.01).max(1).optional(),
  height: z.number().min(0.01).max(1).optional(),
  required: z.boolean().optional(),
  signerId: z.string().uuid().nullable().optional(),
  pageNumber: z.number().int().min(1).optional(),
});

async function verifyFieldOwner(fieldId: string, userId: string) {
  const [row] = await db
    .select({ field: signatureFields, envelope: envelopes })
    .from(signatureFields)
    .innerJoin(documents, eq(signatureFields.documentId, documents.id))
    .innerJoin(envelopes, eq(documents.envelopeId, envelopes.id))
    .where(and(eq(signatureFields.id, fieldId), eq(envelopes.ownerId, userId)))
    .limit(1);
  return row ?? null;
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; fieldId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { fieldId } = await params;
    const row = await verifyFieldOwner(fieldId, session.user.id);
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const body = await req.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success)
      return NextResponse.json(
        { error: "Validation error", details: parsed.error.flatten() },
        { status: 400 }
      );

    const data = parsed.data;
    const updates: Record<string, unknown> = {};
    if (data.x !== undefined) updates.x = String(data.x);
    if (data.y !== undefined) updates.y = String(data.y);
    if (data.width !== undefined) updates.width = String(data.width);
    if (data.height !== undefined) updates.height = String(data.height);
    if (data.required !== undefined) updates.required = data.required;
    if (data.signerId !== undefined) updates.signerId = data.signerId;
    if (data.pageNumber !== undefined) updates.pageNumber = data.pageNumber;

    const [updated] = await db
      .update(signatureFields)
      .set(updates)
      .where(eq(signatureFields.id, fieldId))
      .returning();

    await db.insert(auditEvents).values({
      envelopeId: row.envelope.id,
      event: "FIELD_UPDATED",
      actor: session.user.email ?? session.user.id,
      meta: { fieldId, updates },
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error("[PATCH fields/[fieldId]]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; fieldId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { fieldId } = await params;
    const row = await verifyFieldOwner(fieldId, session.user.id);
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await db.delete(signatureFields).where(eq(signatureFields.id, fieldId));

    await db.insert(auditEvents).values({
      envelopeId: row.envelope.id,
      event: "FIELD_DELETED",
      actor: session.user.email ?? session.user.id,
      meta: { fieldId, type: row.field.type },
    });

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    console.error("[DELETE fields/[fieldId]]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

