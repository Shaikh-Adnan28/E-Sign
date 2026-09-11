import { NextRequest, NextResponse } from "next/server"
import { and, count, desc, asc, eq, ilike, inArray } from "drizzle-orm"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { envelopes, signers, envelopeStatusEnum } from "@/lib/db/schema"

type EnvelopeStatus = (typeof envelopeStatusEnum)[number]

const querySchema = z.object({
  status: z.string().optional(),
  search: z.string().optional(),
  sort: z
    .enum(["newest", "oldest", "name_asc", "name_desc"])
    .optional()
    .default("newest"),
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
})

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const parsed = querySchema.safeParse({
      status: searchParams.get("status") ?? undefined,
      search: searchParams.get("search") ?? undefined,
      sort: searchParams.get("sort") ?? undefined,
      page: searchParams.get("page") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
    })

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid query parameters" }, { status: 400 })
    }

    const { status, search, sort, page, limit } = parsed.data
    const userId = session.user.id
    const offset = (page - 1) * limit

    // Build where conditions
    const conditions = [eq(envelopes.ownerId, userId)]

    if (status && status !== "ALL") {
      const statuses = status.split(",").filter((s): s is EnvelopeStatus =>
        (envelopeStatusEnum as readonly string[]).includes(s)
      )
      if (statuses.length === 1) {
        conditions.push(eq(envelopes.status, statuses[0]))
      } else if (statuses.length > 1) {
        conditions.push(inArray(envelopes.status, statuses))
      }
    }

    if (search) {
      conditions.push(ilike(envelopes.title, `%${search}%`))
    }

    const whereClause = and(...conditions)

    // Build order
    let orderClause
    switch (sort) {
      case "oldest":
        orderClause = asc(envelopes.createdAt)
        break
      case "name_asc":
        orderClause = asc(envelopes.title)
        break
      case "name_desc":
        orderClause = desc(envelopes.title)
        break
      default:
        orderClause = desc(envelopes.createdAt)
    }

    // Fetch envelopes with pagination
    const [rows, totalResult] = await Promise.all([
      db
        .select({
          id: envelopes.id,
          title: envelopes.title,
          status: envelopes.status,
          message: envelopes.message,
          expiresAt: envelopes.expiresAt,
          createdAt: envelopes.createdAt,
          updatedAt: envelopes.updatedAt,
        })
        .from(envelopes)
        .where(whereClause)
        .orderBy(orderClause)
        .limit(limit)
        .offset(offset),
      db
        .select({ count: count() })
        .from(envelopes)
        .where(whereClause),
    ])

    // Fetch signers for returned envelopes
    const envelopeIds = rows.map((r) => r.id)
    const signerRows =
      envelopeIds.length > 0
        ? await db
            .select({
              envelopeId: signers.envelopeId,
              id: signers.id,
              name: signers.name,
              email: signers.email,
              status: signers.status,
              signedAt: signers.signedAt,
            })
            .from(signers)
            .where(inArray(signers.envelopeId, envelopeIds))
        : []

    const signersByEnvelope = signerRows.reduce<Record<string, typeof signerRows>>(
      (acc, s) => {
        if (!acc[s.envelopeId]) acc[s.envelopeId] = []
        acc[s.envelopeId].push(s)
        return acc
      },
      {}
    )

    const data = rows.map((env) => ({
      ...env,
      signers: signersByEnvelope[env.id] ?? [],
    }))

    const total = Number(totalResult[0]?.count ?? 0)
    const totalPages = Math.ceil(total / limit)

    return NextResponse.json({ data, total, page, totalPages })
  } catch {
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const schema = z.object({
      title: z.string().min(1, "Title is required").max(255),
      message: z.string().optional(),
    })

    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? "Invalid input" },
        { status: 400 }
      )
    }

    const [newEnvelope] = await db
      .insert(envelopes)
      .values({
        ownerId: session.user.id,
        title: parsed.data.title,
        message: parsed.data.message,
        status: "DRAFT",
      })
      .returning()

    return NextResponse.json(newEnvelope, { status: 201 })
  } catch {
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 })
  }
}
