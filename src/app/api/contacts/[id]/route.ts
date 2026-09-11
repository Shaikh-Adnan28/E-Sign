import { NextRequest, NextResponse } from "next/server"
import { and, eq } from "drizzle-orm"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { contacts } from "@/lib/db/schema"

// ─── Validation schema ───────────────────────────────────────────

const updateSchema = z.object({
  name: z.string().min(1, "Name is required").max(255).trim().optional(),
  email: z
    .string()
    .email("Invalid email address")
    .max(255)
    .trim()
    .toLowerCase()
    .optional(),
  company: z
    .string()
    .max(255, "Company name is too long")
    .trim()
    .nullable()
    .optional(),
  phone: z
    .string()
    .max(50, "Phone number is too long")
    .trim()
    .nullable()
    .optional()
    .refine(
      (val) => val == null || /^[+\d\s\-().]{0,50}$/.test(val),
      "Invalid phone number format"
    ),
  notes: z.string().max(2000, "Notes are too long").trim().nullable().optional(),
})

// ─── GET /api/contacts/[id] ──────────────────────────────────────

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

    // Scope to owner — prevents IDOR
    const [contact] = await db
      .select()
      .from(contacts)
      .where(and(eq(contacts.id, id), eq(contacts.ownerId, session.user.id)))
      .limit(1)

    if (!contact) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 })
    }

    return NextResponse.json(contact)
  } catch {
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
  }
}

// ─── PATCH /api/contacts/[id] ────────────────────────────────────

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
    const parsed = updateSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Invalid input" },
        { status: 400 }
      )
    }

    // Verify ownership before doing anything else (IDOR protection)
    const [existing] = await db
      .select({ id: contacts.id, email: contacts.email })
      .from(contacts)
      .where(and(eq(contacts.id, id), eq(contacts.ownerId, session.user.id)))
      .limit(1)

    if (!existing) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 })
    }

    const { name, email, company, phone, notes } = parsed.data

    // If email is changing, check for duplicate within the same owner
    if (email && email !== existing.email) {
      const [duplicate] = await db
        .select({ id: contacts.id })
        .from(contacts)
        .where(
          and(
            eq(contacts.ownerId, session.user.id),
            eq(contacts.email, email)
          )
        )
        .limit(1)

      if (duplicate) {
        return NextResponse.json(
          { error: "A contact with this email already exists" },
          { status: 409 }
        )
      }
    }

    // Build update payload — only include provided fields
    const updateData: Partial<typeof contacts.$inferInsert> & {
      updatedAt: Date
    } = { updatedAt: new Date() }

    if (name !== undefined) updateData.name = name
    if (email !== undefined) updateData.email = email
    if (company !== undefined) updateData.company = company
    if (phone !== undefined) updateData.phone = phone
    if (notes !== undefined) updateData.notes = notes

    const [updated] = await db
      .update(contacts)
      .set(updateData)
      .where(eq(contacts.id, id))
      .returning()

    return NextResponse.json(updated)
  } catch {
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
  }
}

// ─── DELETE /api/contacts/[id] ───────────────────────────────────

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

    // Verify ownership before deleting (IDOR protection)
    const [existing] = await db
      .select({ id: contacts.id })
      .from(contacts)
      .where(and(eq(contacts.id, id), eq(contacts.ownerId, session.user.id)))
      .limit(1)

    if (!existing) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 })
    }

    await db.delete(contacts).where(eq(contacts.id, id))

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
  }
}
