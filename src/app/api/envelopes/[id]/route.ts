import { NextRequest, NextResponse } from "next/server"
import { and, eq, desc } from "drizzle-orm"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { envelopes, documents, signers, signatureFields, auditEvents } from "@/lib/db/schema"

// ─── GET /api/envelopes/[id] ──────────────────────────────────────

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params

    // Fetch envelope (must belong to current user)
    const [envelope] = await db
      .select()
      .from(envelopes)
      .where(and(eq(envelopes.id, id), eq(envelopes.ownerId, session.user.id)))
      .limit(1)

    if (!envelope) {
      return NextResponse.json({ error: "Envelope not found" }, { status: 404 })
    }

    // Fetch related data in parallel
    const [envelopeDocuments, envelopeSigners, events] = await Promise.all([
      db
        .select()
        .from(documents)
        .where(eq(documents.envelopeId, id)),
      db
        .select()
        .from(signers)
        .where(eq(signers.envelopeId, id))
        .orderBy(signers.order),
      db
        .select()
        .from(auditEvents)
        .where(eq(auditEvents.envelopeId, id))
        .orderBy(desc(auditEvents.createdAt)),
    ])

    // Fetch signature fields for all documents
    const documentIds = envelopeDocuments.map((d) => d.id)
    const fields =
      documentIds.length > 0
        ? await db
            .select()
            .from(signatureFields)
            .where(
              documentIds.length === 1
                ? eq(signatureFields.documentId, documentIds[0])
                : undefined
            )
        : []

    return NextResponse.json({
      ...envelope,
      documents: envelopeDocuments.map((doc) => ({
        ...doc,
        fields: fields.filter((f) => f.documentId === doc.id),
      })),
      signers: envelopeSigners,
      auditEvents: events,
    })
  } catch {
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
  }
}

// ─── PATCH /api/envelopes/[id] ────────────────────────────────────

const patchSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  status: z
    .enum([
      "DRAFT",
      "SENT",
      "DELIVERED",
      "VIEWED",
      "PARTIALLY_SIGNED",
      "COMPLETED",
      "DECLINED",
      "EXPIRED",
      "CANCELLED",
    ])
    .optional(),
  message: z.string().optional(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()
    const parsed = patchSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Invalid input" },
        { status: 400 }
      )
    }

    // Verify ownership
    const [existing] = await db
      .select({ id: envelopes.id, status: envelopes.status })
      .from(envelopes)
      .where(and(eq(envelopes.id, id), eq(envelopes.ownerId, session.user.id)))
      .limit(1)

    if (!existing) {
      return NextResponse.json({ error: "Envelope not found" }, { status: 404 })
    }

    const { title, status, message } = parsed.data

    // Build update payload
    const updateData: Partial<typeof envelopes.$inferInsert> = {
      updatedAt: new Date(),
    }
    if (title !== undefined) updateData.title = title
    if (status !== undefined) updateData.status = status
    if (message !== undefined) updateData.message = message

    const [updated] = await db
      .update(envelopes)
      .set(updateData)
      .where(eq(envelopes.id, id))
      .returning()

    // Record audit event when status changes
    if (status && status !== existing.status) {
      await db.insert(auditEvents).values({
        envelopeId: id,
        event: `status.changed.${status.toLowerCase()}`,
        actor: session.user.email,
        meta: { from: existing.status, to: status },
      })
    }

    return NextResponse.json(updated)
  } catch {
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
  }
}

// ─── DELETE /api/envelopes/[id] ───────────────────────────────────

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params

    // Only DRAFT envelopes can be deleted
    const [existing] = await db
      .select({ id: envelopes.id, status: envelopes.status })
      .from(envelopes)
      .where(and(eq(envelopes.id, id), eq(envelopes.ownerId, session.user.id)))
      .limit(1)

    if (!existing) {
      return NextResponse.json({ error: "Envelope not found" }, { status: 404 })
    }

    if (existing.status !== "DRAFT") {
      return NextResponse.json(
        { error: "Only draft envelopes can be deleted" },
        { status: 409 }
      )
    }

    await db.delete(envelopes).where(eq(envelopes.id, id))

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
  }
}
