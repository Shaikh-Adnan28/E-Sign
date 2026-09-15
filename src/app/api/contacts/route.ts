import { NextRequest, NextResponse } from "next/server"
import { and, count, asc, desc, eq, ilike, or } from "drizzle-orm"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { contacts } from "@/lib/db/schema"

// ─── Validation schemas ──────────────────────────────────────────

// ─── Validation schemas ──────────────────────────────────────────

const querySchema = z.object({
  search: z.string().optional(),
  tag: z.string().optional(),
  sort: z
    .enum(["newest", "oldest", "name_asc", "name_desc", "recently_used"])
    .optional()
    .default("name_asc"),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
})

const createSchema = z.object({
  name: z.string().min(1, "Name is required").max(255, "Name is too long").trim(),
  email: z.string().email("Invalid email address").max(255).trim().toLowerCase(),
  company: z.string().max(255, "Company name is too long").trim().optional(),
  phone: z
    .string()
    .max(50, "Phone number is too long")
    .trim()
    .optional()
    .refine(
      (val) => !val || /^[+\d\s\-().]{0,50}$/.test(val),
      "Invalid phone number format"
    ),
  tags: z.array(z.string()).optional(),
  notes: z.string().max(2000, "Notes are too long").trim().optional(),
})

// ─── GET /api/contacts ───────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const parsed = querySchema.safeParse({
      search: searchParams.get("search") ?? undefined,
      tag: searchParams.get("tag") ?? undefined,
      sort: searchParams.get("sort") ?? undefined,
      page: searchParams.get("page") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
    })

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Invalid query parameters" },
        { status: 400 }
      )
    }

    const { search, tag, sort, page, limit } = parsed.data
    const userId = session.user.id
    const offset = (page - 1) * limit

    // Build conditions — always scope to owner (prevents cross-user reads)
    const conditions = [eq(contacts.ownerId, userId)]

    if (search) {
      conditions.push(
        or(
          ilike(contacts.name, `%${search}%`),
          ilike(contacts.email, `%${search}%`),
          ilike(contacts.company, `%${search}%`)
        )!
      )
    }

    const whereClause = and(...conditions)

    // Build order
    const orderClause =
      sort === "oldest"
        ? asc(contacts.createdAt)
        : sort === "name_desc"
          ? desc(contacts.name)
          : sort === "newest"
            ? desc(contacts.createdAt)
            : sort === "recently_used"
              ? desc(contacts.lastUsedAt)
              : asc(contacts.name) // name_asc default

    const [rows, totalResult] = await Promise.all([
      db
        .select()
        .from(contacts)
        .where(whereClause)
        .orderBy(orderClause)
        .limit(limit)
        .offset(offset),
      db.select({ count: count() }).from(contacts).where(whereClause),
    ])

    // In-memory filter for JSONB tags if tag parameter is provided
    let filteredRows = rows
    if (tag && tag.trim()) {
      const tagLower = tag.trim().toLowerCase()
      filteredRows = rows.filter((r) =>
        Array.isArray(r.tags) && r.tags.some((t) => t.toLowerCase() === tagLower)
      )
    }

    const total = tag ? filteredRows.length : Number(totalResult[0]?.count ?? 0)
    const totalPages = Math.ceil(total / limit) || 1

    return NextResponse.json({ data: filteredRows, total, page, totalPages })
  } catch {
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
  }
}

// ─── POST /api/contacts ──────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const parsed = createSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Invalid input" },
        { status: 400 }
      )
    }

    const { name, email, company, phone, tags, notes } = parsed.data
    const userId = session.user.id

    // Check for duplicate email within the same owner
    const [existing] = await db
      .select({ id: contacts.id })
      .from(contacts)
      .where(and(eq(contacts.ownerId, userId), eq(contacts.email, email)))
      .limit(1)

    if (existing) {
      return NextResponse.json(
        { error: "A contact with this email already exists" },
        { status: 409 }
      )
    }

    const [newContact] = await db
      .insert(contacts)
      .values({
        ownerId: userId,
        name,
        email,
        company: company ?? null,
        phone: phone ?? null,
        tags: tags ?? [],
        notes: notes ?? null,
      })
      .returning()

    return NextResponse.json(newContact, { status: 201 })
  } catch (error) {
    console.error("[POST /api/contacts]", error)
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
  }
}
