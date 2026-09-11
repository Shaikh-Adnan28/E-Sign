/**
 * Tests for /api/contacts/[id] — GET, PATCH, DELETE.
 * Covers auth enforcement, IDOR protection, and CRUD.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

// ── Mocks ─────────────────────────────────────────────────────────

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }))

vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}))

vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>()
  return {
    ...actual,
    and: (...args: unknown[]) => ({ and: args }),
    eq: (col: unknown, val: unknown) => ({ eq: [col, val] }),
  }
})

vi.mock("@/lib/db/schema", () => ({
  contacts: { ownerId: "ownerId", id: "id", email: "email", name: "name" },
}))

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { GET, PATCH, DELETE } from "../[id]/route"

const mockAuth = auth as ReturnType<typeof vi.fn>
const mockDb = db as unknown as {
  select: ReturnType<typeof vi.fn>
  insert: ReturnType<typeof vi.fn>
  update: ReturnType<typeof vi.fn>
  delete: ReturnType<typeof vi.fn>
}

// Build params as Next.js App Router expects
const makeParams = (id: string) => ({ params: Promise.resolve({ id }) })

function makeRequest(method: string, url: string, body?: unknown): NextRequest {
  return new NextRequest(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  })
}

// Helper — a select chain that resolves with given rows
function selectReturning(rows: unknown[]) {
  return {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(rows),
  }
}

const OWNER_ID = "owner-123"
const OTHER_USER_ID = "attacker-456"
const CONTACT_ID = "contact-abc"

const fakeContact = {
  id: CONTACT_ID,
  ownerId: OWNER_ID,
  name: "Alice",
  email: "alice@x.com",
  company: "Acme",
  phone: null,
  notes: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

// ── GET /api/contacts/[id] ────────────────────────────────────────

describe("GET /api/contacts/[id]", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null)
    const res = await GET(
      makeRequest("GET", `http://localhost/api/contacts/${CONTACT_ID}`),
      makeParams(CONTACT_ID)
    )
    expect(res.status).toBe(401)
  })

  it("returns contact for owner", async () => {
    mockAuth.mockResolvedValue({ user: { id: OWNER_ID } })
    mockDb.select.mockReturnValue(selectReturning([fakeContact]))

    const res = await GET(
      makeRequest("GET", `http://localhost/api/contacts/${CONTACT_ID}`),
      makeParams(CONTACT_ID)
    )
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.id).toBe(CONTACT_ID)
    expect(json.name).toBe("Alice")
  })

  it("returns 404 for IDOR — different user's contact", async () => {
    mockAuth.mockResolvedValue({ user: { id: OTHER_USER_ID } })
    // DB returns empty because ownerId doesn't match
    mockDb.select.mockReturnValue(selectReturning([]))

    const res = await GET(
      makeRequest("GET", `http://localhost/api/contacts/${CONTACT_ID}`),
      makeParams(CONTACT_ID)
    )
    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.error).toBe("Contact not found")
  })

  it("returns 404 for non-existent contact", async () => {
    mockAuth.mockResolvedValue({ user: { id: OWNER_ID } })
    mockDb.select.mockReturnValue(selectReturning([]))

    const res = await GET(
      makeRequest("GET", `http://localhost/api/contacts/nonexistent`),
      makeParams("nonexistent")
    )
    expect(res.status).toBe(404)
  })
})

// ── PATCH /api/contacts/[id] ──────────────────────────────────────

describe("PATCH /api/contacts/[id]", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null)
    const res = await PATCH(
      makeRequest("PATCH", `http://localhost/api/contacts/${CONTACT_ID}`, {
        name: "New Name",
      }),
      makeParams(CONTACT_ID)
    )
    expect(res.status).toBe(401)
  })

  it("returns 404 for IDOR — attacker tries to update owner's contact", async () => {
    mockAuth.mockResolvedValue({ user: { id: OTHER_USER_ID } })
    // Ownership check fails — returns no rows
    mockDb.select.mockReturnValue(selectReturning([]))

    const res = await PATCH(
      makeRequest("PATCH", `http://localhost/api/contacts/${CONTACT_ID}`, {
        name: "Hacked",
      }),
      makeParams(CONTACT_ID)
    )
    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.error).toBe("Contact not found")
  })

  it("returns 400 for invalid email in update", async () => {
    mockAuth.mockResolvedValue({ user: { id: OWNER_ID } })

    const res = await PATCH(
      makeRequest("PATCH", `http://localhost/api/contacts/${CONTACT_ID}`, {
        email: "not-an-email",
      }),
      makeParams(CONTACT_ID)
    )
    expect(res.status).toBe(400)
  })

  it("returns 400 for empty name in update", async () => {
    mockAuth.mockResolvedValue({ user: { id: OWNER_ID } })

    const res = await PATCH(
      makeRequest("PATCH", `http://localhost/api/contacts/${CONTACT_ID}`, {
        name: "",
      }),
      makeParams(CONTACT_ID)
    )
    expect(res.status).toBe(400)
  })

  it("updates contact successfully for owner", async () => {
    mockAuth.mockResolvedValue({ user: { id: OWNER_ID } })

    const updatedContact = { ...fakeContact, name: "Alice Updated" }

    // ownership check select
    mockDb.select.mockReturnValue(
      selectReturning([{ id: CONTACT_ID, email: fakeContact.email }])
    )

    // update chain
    const updateChain = {
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([updatedContact]),
    }
    mockDb.update.mockReturnValue(updateChain)

    const res = await PATCH(
      makeRequest("PATCH", `http://localhost/api/contacts/${CONTACT_ID}`, {
        name: "Alice Updated",
      }),
      makeParams(CONTACT_ID)
    )
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.name).toBe("Alice Updated")
  })

  it("returns 409 when updating to an already-used email", async () => {
    mockAuth.mockResolvedValue({ user: { id: OWNER_ID } })

    let callCount = 0
    mockDb.select.mockImplementation(() => {
      callCount++
      if (callCount === 1) {
        // ownership check — found
        return selectReturning([{ id: CONTACT_ID, email: "alice@x.com" }])
      }
      // duplicate email check — found another contact with target email
      return selectReturning([{ id: "other-contact" }])
    })

    const res = await PATCH(
      makeRequest("PATCH", `http://localhost/api/contacts/${CONTACT_ID}`, {
        email: "taken@x.com",
      }),
      makeParams(CONTACT_ID)
    )
    expect(res.status).toBe(409)
    const json = await res.json()
    expect(json.error).toMatch(/already exists/i)
  })
})

// ── DELETE /api/contacts/[id] ─────────────────────────────────────

describe("DELETE /api/contacts/[id]", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null)
    const res = await DELETE(
      makeRequest("DELETE", `http://localhost/api/contacts/${CONTACT_ID}`),
      makeParams(CONTACT_ID)
    )
    expect(res.status).toBe(401)
  })

  it("returns 404 for IDOR — attacker tries to delete owner's contact", async () => {
    mockAuth.mockResolvedValue({ user: { id: OTHER_USER_ID } })
    mockDb.select.mockReturnValue(selectReturning([]))

    const res = await DELETE(
      makeRequest("DELETE", `http://localhost/api/contacts/${CONTACT_ID}`),
      makeParams(CONTACT_ID)
    )
    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.error).toBe("Contact not found")
  })

  it("deletes contact successfully for owner", async () => {
    mockAuth.mockResolvedValue({ user: { id: OWNER_ID } })
    mockDb.select.mockReturnValue(selectReturning([{ id: CONTACT_ID }]))

    const deleteChain = {
      where: vi.fn().mockResolvedValue(undefined),
    }
    mockDb.delete.mockReturnValue(deleteChain)

    const res = await DELETE(
      makeRequest("DELETE", `http://localhost/api/contacts/${CONTACT_ID}`),
      makeParams(CONTACT_ID)
    )
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
  })

  it("returns 404 when contact does not exist", async () => {
    mockAuth.mockResolvedValue({ user: { id: OWNER_ID } })
    mockDb.select.mockReturnValue(selectReturning([]))

    const res = await DELETE(
      makeRequest("DELETE", `http://localhost/api/contacts/nonexistent`),
      makeParams("nonexistent")
    )
    expect(res.status).toBe(404)
  })
})
