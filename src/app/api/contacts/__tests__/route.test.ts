/**
 * Integration-style unit tests for /api/contacts route handlers.
 * auth and db are mocked — no real DB or HTTP server needed.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

// ── Mocks ─────────────────────────────────────────────────────────

// Mock auth
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}))

// Mock db
vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}))

// Mock drizzle operators (used in where clauses but not exercised in unit tests)
vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>()
  return {
    ...actual,
    and: (...args: unknown[]) => ({ and: args }),
    eq: (col: unknown, val: unknown) => ({ eq: [col, val] }),
    ilike: (col: unknown, val: unknown) => ({ ilike: [col, val] }),
    or: (...args: unknown[]) => ({ or: args }),
    count: () => ({ count: true }),
    asc: (col: unknown) => ({ asc: col }),
    desc: (col: unknown) => ({ desc: col }),
  }
})

vi.mock("@/lib/db/schema", () => ({
  contacts: { ownerId: "ownerId", id: "id", email: "email", name: "name", createdAt: "createdAt" },
}))

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { GET, POST } from "../route"

const mockAuth = auth as ReturnType<typeof vi.fn>
const mockDb = db as unknown as {
  select: ReturnType<typeof vi.fn>
  insert: ReturnType<typeof vi.fn>
  update: ReturnType<typeof vi.fn>
  delete: ReturnType<typeof vi.fn>
}

// Helper — build a minimal NextRequest
function makeRequest(
  method: string,
  url: string,
  body?: unknown
): NextRequest {
  return new NextRequest(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  })
}

// Helper — build a chainable drizzle select mock that returns given rows
function mockSelectChain(rows: unknown[], countRows = [{ count: rows.length }]) {
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockResolvedValue(rows),
  }
  const countChain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(countRows),
  }
  // First call returns data chain, second returns count chain
  let callCount = 0
  mockDb.select.mockImplementation(() => {
    callCount++
    return callCount % 2 !== 0 ? chain : countChain
  })
  return chain
}

// ── GET /api/contacts ─────────────────────────────────────────────

describe("GET /api/contacts", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null)
    const req = makeRequest("GET", "http://localhost/api/contacts")
    const res = await GET(req)
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error).toBe("Unauthorized")
  })

  it("returns 401 when session has no user", async () => {
    mockAuth.mockResolvedValue({})
    const req = makeRequest("GET", "http://localhost/api/contacts")
    const res = await GET(req)
    expect(res.status).toBe(401)
  })

  it("returns paginated contacts for authenticated user", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1", email: "u@x.com" } })
    const fakeContacts = [
      { id: "c1", name: "Alice", email: "alice@x.com", ownerId: "user-1" },
      { id: "c2", name: "Bob", email: "bob@x.com", ownerId: "user-1" },
    ]
    mockSelectChain(fakeContacts, [{ count: 2 }])

    const req = makeRequest("GET", "http://localhost/api/contacts?page=1&limit=20")
    const res = await GET(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data).toHaveLength(2)
    expect(json.total).toBe(2)
    expect(json.page).toBe(1)
    expect(json.totalPages).toBe(1)
  })

  it("returns 400 on invalid page param", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1", email: "u@x.com" } })
    const req = makeRequest("GET", "http://localhost/api/contacts?page=-1")
    const res = await GET(req)
    expect(res.status).toBe(400)
  })

  it("returns empty data when no contacts exist", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1", email: "u@x.com" } })
    mockSelectChain([], [{ count: 0 }])
    const req = makeRequest("GET", "http://localhost/api/contacts")
    const res = await GET(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data).toHaveLength(0)
    expect(json.total).toBe(0)
  })
})

// ── POST /api/contacts ────────────────────────────────────────────

describe("POST /api/contacts", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue(null)
    const req = makeRequest("POST", "http://localhost/api/contacts", {
      name: "Alice",
      email: "alice@x.com",
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it("returns 400 when name is missing", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1", email: "u@x.com" } })
    const req = makeRequest("POST", "http://localhost/api/contacts", {
      email: "alice@x.com",
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    // Zod v4 uses "Required" for missing required fields
    expect(typeof json.error).toBe("string")
    expect(json.error.length).toBeGreaterThan(0)
  })

  it("returns 400 when email is invalid", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1", email: "u@x.com" } })
    const req = makeRequest("POST", "http://localhost/api/contacts", {
      name: "Alice",
      email: "not-an-email",
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/email/i)
  })

  it("returns 409 when email already exists for this user", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1", email: "u@x.com" } })

    // duplicate check select returns existing contact
    const existingChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([{ id: "existing-id" }]),
    }
    mockDb.select.mockReturnValue(existingChain)

    const req = makeRequest("POST", "http://localhost/api/contacts", {
      name: "Alice",
      email: "alice@x.com",
    })
    const res = await POST(req)
    expect(res.status).toBe(409)
    const json = await res.json()
    expect(json.error).toMatch(/already exists/i)
  })

  it("creates contact and returns 201 for valid input", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-1", email: "u@x.com" } })

    const newContact = {
      id: "new-id",
      ownerId: "user-1",
      name: "Alice",
      email: "alice@x.com",
      company: null,
      phone: null,
      notes: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    // duplicate check returns empty
    const dupChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    }
    mockDb.select.mockReturnValue(dupChain)

    // insert chain
    const insertChain = {
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([newContact]),
    }
    mockDb.insert.mockReturnValue(insertChain)

    const req = makeRequest("POST", "http://localhost/api/contacts", {
      name: "Alice",
      email: "alice@x.com",
    })
    const res = await POST(req)
    expect(res.status).toBe(201)
    const json = await res.json()
    expect(json.id).toBe("new-id")
    expect(json.name).toBe("Alice")
    expect(json.email).toBe("alice@x.com")
  })
})
