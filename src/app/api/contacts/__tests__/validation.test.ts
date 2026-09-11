/**
 * Pure unit tests for contacts Zod validation schemas.
 * No DB or auth required.
 */
import { describe, it, expect } from "vitest"
import { z } from "zod"

// ── Replicate the schemas from route.ts ──────────────────────────

const createSchema = z.object({
  name: z.string().min(1, "Name is required").max(255).trim(),
  email: z.string().email("Invalid email address").max(255).trim().toLowerCase(),
  company: z.string().max(255).trim().optional(),
  phone: z
    .string()
    .max(50)
    .trim()
    .optional()
    .refine(
      (val) => !val || /^[+\d\s\-().]{0,50}$/.test(val),
      "Invalid phone number format"
    ),
  notes: z.string().max(2000).trim().optional(),
})

const updateSchema = z.object({
  name: z.string().min(1, "Name is required").max(255).trim().optional(),
  email: z.string().email("Invalid email address").max(255).trim().toLowerCase().optional(),
  company: z.string().max(255).trim().nullable().optional(),
  phone: z
    .string()
    .max(50)
    .trim()
    .nullable()
    .optional()
    .refine(
      (val) => val == null || /^[+\d\s\-().]{0,50}$/.test(val),
      "Invalid phone number format"
    ),
  notes: z.string().max(2000).trim().nullable().optional(),
})

// ── createSchema ─────────────────────────────────────────────────

describe("createSchema", () => {
  it("accepts a valid minimal contact", () => {
    const result = createSchema.safeParse({
      name: "Jane Smith",
      email: "jane@example.com",
    })
    expect(result.success).toBe(true)
  })

  it("accepts a fully populated contact", () => {
    const result = createSchema.safeParse({
      name: "John Doe",
      email: "JOHN@EXAMPLE.COM",
      company: "Acme Corp",
      phone: "+1 (555) 000-0000",
      notes: "Met at conference",
    })
    expect(result.success).toBe(true)
    if (result.success) {
      // email should be lowercased
      expect(result.data.email).toBe("john@example.com")
      // name/company/notes should be trimmed
      expect(result.data.name).toBe("John Doe")
    }
  })

  it("rejects missing name", () => {
    const result = createSchema.safeParse({ email: "a@b.com" })
    expect(result.success).toBe(false)
  })

  it("rejects empty name", () => {
    const result = createSchema.safeParse({ name: "", email: "a@b.com" })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.errors[0].message).toBe("Name is required")
    }
  })

  it("rejects missing email", () => {
    const result = createSchema.safeParse({ name: "Alice" })
    expect(result.success).toBe(false)
  })

  it("rejects invalid email", () => {
    const result = createSchema.safeParse({
      name: "Alice",
      email: "not-an-email",
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.errors[0].message).toBe("Invalid email address")
    }
  })

  it("rejects name longer than 255 chars", () => {
    const result = createSchema.safeParse({
      name: "A".repeat(256),
      email: "a@b.com",
    })
    expect(result.success).toBe(false)
  })

  it("rejects invalid phone format", () => {
    const result = createSchema.safeParse({
      name: "Alice",
      email: "a@b.com",
      phone: "INVALID!!PHONE",
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.errors[0].message).toBe("Invalid phone number format")
    }
  })

  it("accepts valid phone formats", () => {
    const phones = ["+1 555 000 0000", "(555) 000-0000", "+44.20.1234.5678"]
    for (const phone of phones) {
      const result = createSchema.safeParse({
        name: "Alice",
        email: "a@b.com",
        phone,
      })
      expect(result.success).toBe(true)
    }
  })

  it("rejects notes longer than 2000 chars", () => {
    const result = createSchema.safeParse({
      name: "Alice",
      email: "a@b.com",
      notes: "x".repeat(2001),
    })
    expect(result.success).toBe(false)
  })

  it("trims whitespace from name", () => {
    const result = createSchema.safeParse({
      name: "  Alice  ",
      email: "a@b.com",
    })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.name).toBe("Alice")
  })
})

// ── updateSchema ─────────────────────────────────────────────────

describe("updateSchema", () => {
  it("accepts empty object (all fields optional)", () => {
    const result = updateSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it("accepts partial update with just name", () => {
    const result = updateSchema.safeParse({ name: "New Name" })
    expect(result.success).toBe(true)
  })

  it("accepts null for nullable fields", () => {
    const result = updateSchema.safeParse({
      company: null,
      phone: null,
      notes: null,
    })
    expect(result.success).toBe(true)
  })

  it("rejects empty name when provided", () => {
    const result = updateSchema.safeParse({ name: "" })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.errors[0].message).toBe("Name is required")
    }
  })

  it("rejects invalid email when provided", () => {
    const result = updateSchema.safeParse({ email: "bad" })
    expect(result.success).toBe(false)
  })

  it("lowercases email", () => {
    const result = updateSchema.safeParse({ email: "UPPER@CASE.COM" })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.email).toBe("upper@case.com")
  })
})
