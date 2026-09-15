import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  signatureFields,
  documents,
  envelopes,
  auditEvents,
} from "@/lib/db/schema";
import { auth } from "@/lib/auth";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

const fieldSchema = z.object({
  type: z.enum(["SIGNATURE", "INITIALS", "TEXT", "DATE", "CHECKBOX"]),
  pageNumber: z.number().int().min(1),
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  width: z.number().min(0.01).max(1),
  height: z.number().min(0.01).max(1),
  required: z.boolean().optional().default(true),
  signerId: z.string().uuid().nullable().optional(),
});

async function verifyDocumentOwner(docId: string, userId: string) {
  const [row] = await db
    .select({ doc: documents, envelope: envelopes })
    .from(documents)
    .innerJoin(envelopes, eq(documents.envelopeId, envelopes.id))
    .where(and(eq(documents.id, docId), eq(envelopes.ownerId, userId)))
    .limit(1);
  return row ?? null;
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
    const row = await verifyDocumentOwner(id, session.user.id);
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const fields = await db
      .select()
      .from(signatureFields)
      .where(eq(signatureFields.documentId, id));

    return NextResponse.json(fields);
  } catch (err) {
    console.error("[GET /api/documents/[id]/fields]", err);
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
    const row = await verifyDocumentOwner(id, session.user.id);
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (row.envelope.status !== "DRAFT")
      return NextResponse.json(
        { error: "Fields cannot be added after the document has been sent" },
        { status: 409 }
      );

    const body = await req.json();
    const parsed = fieldSchema.safeParse(body);
    if (!parsed.success)
      return NextResponse.json(
        { error: "Validation error", details: parsed.error.flatten() },
        { status: 400 }
      );

    const data = parsed.data;
    const [field] = await db
      .insert(signatureFields)
      .values({
        documentId: id,
        type: data.type,
        pageNumber: data.pageNumber,
        x: String(data.x),
        y: String(data.y),
        width: String(data.width),
        height: String(data.height),
        required: data.required,
        signerId: data.signerId ?? null,
      })
      .returning();

    await db.insert(auditEvents).values({
      envelopeId: row.envelope.id,
      event: "FIELD_ADDED",
      actor: session.user.email ?? session.user.id,
      meta: { fieldId: field.id, type: field.type },
    });

    return NextResponse.json(field, { status: 201 });
  } catch (err) {
    console.error("[POST /api/documents/[id]/fields]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

