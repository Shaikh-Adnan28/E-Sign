import { db } from "@/lib/db";
import { contacts, signers, auditEvents, envelopes } from "@/lib/db/schema";
import { eq, and, sql, desc, inArray } from "drizzle-orm";

export interface ContactActivityItem {
  id: string;
  envelopeId: string;
  envelopeTitle: string;
  event: string;
  createdAt: Date | null;
}

/**
  * Record usage timestamp and increment usage counter when a contact is selected as a recipient.
  */
export async function recordContactUsage(contactId: string, ownerId: string): Promise<void> {
  await db
    .update(contacts)
    .set({
      usageCount: sql`${contacts.usageCount} + 1`,
      lastUsedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(and(eq(contacts.id, contactId), eq(contacts.ownerId, ownerId)));
}

/**
  * Normalizes email and checks if a contact with this email already exists for the owner.
  */
export async function findDuplicateContact(ownerId: string, email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const [existing] = await db
    .select()
    .from(contacts)
    .where(and(eq(contacts.ownerId, ownerId), eq(contacts.email, normalizedEmail)))
    .limit(1);
  return existing ?? null;
}

/**
  * Fetch historical signing request activities for a contact's email without duplicating data.
  */
export async function getContactActivity(ownerId: string, contactEmail: string): Promise<ContactActivityItem[]> {
  const normalizedEmail = contactEmail.trim().toLowerCase();

  // Find all signer rows for this email belonging to envelopes owned by ownerId
  const signerRows = await db
    .select({ envelopeId: signers.envelopeId })
    .from(signers)
    .innerJoin(envelopes, eq(signers.envelopeId, envelopes.id))
    .where(and(eq(envelopes.ownerId, ownerId), eq(signers.email, normalizedEmail)));

  if (signerRows.length === 0) return [];

  const envelopeIds = Array.from(new Set(signerRows.map((s) => s.envelopeId)));

  const events = await db
    .select({
      id: auditEvents.id,
      envelopeId: auditEvents.envelopeId,
      event: auditEvents.event,
      createdAt: auditEvents.createdAt,
      envelopeTitle: envelopes.title,
    })
    .from(auditEvents)
    .innerJoin(envelopes, eq(auditEvents.envelopeId, envelopes.id))
    .where(inArray(auditEvents.envelopeId, envelopeIds))
    .orderBy(desc(auditEvents.createdAt))
    .limit(15);

  return events;
}

/**
  * Parses CSV content and imports contacts for an owner.
  */
export async function importContactsCsv(ownerId: string, csvContent: string) {
  const lines = csvContent.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length <= 1) {
    return { success: false, error: "CSV file is empty or missing headers", importedCount: 0, duplicateCount: 0, invalidCount: 0, errors: [] };
  }

  const header = lines[0].toLowerCase().split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
  const nameIdx = header.findIndex((h) => h === "name" || h === "full name");
  const emailIdx = header.findIndex((h) => h === "email" || h === "email address");
  const companyIdx = header.findIndex((h) => h === "company" || h === "organization");
  const phoneIdx = header.findIndex((h) => h === "phone" || h === "mobile");
  const tagsIdx = header.findIndex((h) => h === "tags" || h === "tag");

  if (emailIdx === -1) {
    return { success: false, error: "Missing required 'email' column in CSV header", importedCount: 0, duplicateCount: 0, invalidCount: 0, errors: [] };
  }

  let importedCount = 0;
  let duplicateCount = 0;
  let invalidCount = 0;
  const errorDetails: Array<{ row: number; email?: string; reason: string }> = [];

  // Fetch existing contacts for this owner for fast lookup
  const existingContacts = await db
    .select({ email: contacts.email })
    .from(contacts)
    .where(eq(contacts.ownerId, ownerId));

  const existingEmailSet = new Set(existingContacts.map((c) => c.email.toLowerCase()));

  for (let i = 1; i < lines.length; i++) {
    const row = lines[i].split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
    const email = (row[emailIdx] || "").trim().toLowerCase();
    const name = nameIdx !== -1 ? (row[nameIdx] || "").trim() : email.split("@")[0];
    const company = companyIdx !== -1 ? (row[companyIdx] || "").trim() : "";
    const phone = phoneIdx !== -1 ? (row[phoneIdx] || "").trim() : "";
    const tagsRaw = tagsIdx !== -1 ? (row[tagsIdx] || "").trim() : "";
    const tags = tagsRaw ? tagsRaw.split(";").map((t) => t.trim()).filter(Boolean) : [];

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      invalidCount++;
      errorDetails.push({ row: i + 1, email, reason: "Invalid or missing email format" });
      continue;
    }

    if (existingEmailSet.has(email)) {
      duplicateCount++;
      errorDetails.push({ row: i + 1, email, reason: "Email already exists in contacts" });
      continue;
    }

    await db.insert(contacts).values({
      ownerId,
      name: name || email,
      email,
      company: company || null,
      phone: phone || null,
      tags,
    });

    existingEmailSet.add(email);
    importedCount++;
  }

  return {
    success: true,
    importedCount,
    duplicateCount,
    invalidCount,
    totalRows: lines.length - 1,
    errors: errorDetails,
  };
}

/**
  * Generates CSV string for exporting an owner's contacts.
  */
export async function exportContactsCsv(ownerId: string): Promise<string> {
  const userContacts = await db
    .select()
    .from(contacts)
    .where(eq(contacts.ownerId, ownerId))
    .orderBy(contacts.name);

  const headers = ["Name", "Email", "Company", "Phone", "Tags", "Usage Count", "Last Used At", "Created At"];
  const rows = userContacts.map((c) => [
    `"${(c.name || "").replace(/"/g, '""')}"`,
    `"${(c.email || "").replace(/"/g, '""')}"`,
    `"${(c.company || "").replace(/"/g, '""')}"`,
    `"${(c.phone || "").replace(/"/g, '""')}"`,
    `"${(c.tags || []).join("; ").replace(/"/g, '""')}"`,
    c.usageCount,
    c.lastUsedAt ? c.lastUsedAt.toISOString() : "",
    c.createdAt ? c.createdAt.toISOString() : "",
  ]);

  return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
}
