import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { contacts, contactGroupMembers } from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { z } from "zod";

const bulkSchema = z.object({
  contactIds: z.array(z.string().uuid()).min(1, "Select at least one contact"),
  action: z.enum(["add_tags", "remove_tags", "add_to_group", "delete"]),
  tags: z.array(z.string()).optional(),
  groupId: z.string().uuid().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const body = await req.json();
    const parsed = bulkSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation error", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { contactIds, action, tags, groupId } = parsed.data;

    // Fetch owned contacts matching given contactIds
    const ownedContacts = await db
      .select()
      .from(contacts)
      .where(and(eq(contacts.ownerId, userId), inArray(contacts.id, contactIds)));

    if (ownedContacts.length === 0) {
      return NextResponse.json({ error: "No matching contacts found" }, { status: 404 });
    }

    const validIds = ownedContacts.map((c) => c.id);

    if (action === "delete") {
      await db.delete(contacts).where(inArray(contacts.id, validIds));
      return NextResponse.json({ success: true, count: validIds.length });
    }

    if (action === "add_tags" && tags && tags.length > 0) {
      for (const c of ownedContacts) {
        const existingTags = Array.isArray(c.tags) ? c.tags : [];
        const merged = Array.from(new Set([...existingTags, ...tags]));
        await db
          .update(contacts)
          .set({ tags: merged, updatedAt: new Date() })
          .where(eq(contacts.id, c.id));
      }
      return NextResponse.json({ success: true, count: validIds.length });
    }

    if (action === "remove_tags" && tags && tags.length > 0) {
      const removeSet = new Set(tags.map((t) => t.toLowerCase()));
      for (const c of ownedContacts) {
        const existingTags = Array.isArray(c.tags) ? c.tags : [];
        const filtered = existingTags.filter((t) => !removeSet.has(t.toLowerCase()));
        await db
          .update(contacts)
          .set({ tags: filtered, updatedAt: new Date() })
          .where(eq(contacts.id, c.id));
      }
      return NextResponse.json({ success: true, count: validIds.length });
    }

    if (action === "add_to_group" && groupId) {
      const groupValues = validIds.map((cId) => ({
        groupId,
        contactId: cId,
      }));
      // On conflict ignore duplicate memberships
      await db
        .insert(contactGroupMembers)
        .values(groupValues)
        .onConflictDoNothing();

      return NextResponse.json({ success: true, count: validIds.length });
    }

    return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
  } catch (err) {
    console.error("[POST /api/contacts/bulk]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
