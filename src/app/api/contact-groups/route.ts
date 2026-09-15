import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { contactGroups, contactGroupMembers, contacts } from "@/lib/db/schema";
import { eq, desc, inArray } from "drizzle-orm";
import { z } from "zod";

const createGroupSchema = z.object({
  name: z.string().min(1, "Group name is required").max(100).trim(),
  description: z.string().max(500).optional(),
  contactIds: z.array(z.string().uuid()).optional().default([]),
});

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    const groups = await db
      .select()
      .from(contactGroups)
      .where(eq(contactGroups.ownerId, userId))
      .orderBy(desc(contactGroups.updatedAt));

    const groupIds = groups.map((g) => g.id);
    const membersList = groupIds.length > 0
      ? await db
          .select({
            groupId: contactGroupMembers.groupId,
            contact: contacts,
          })
          .from(contactGroupMembers)
          .innerJoin(contacts, eq(contactGroupMembers.contactId, contacts.id))
          .where(inArray(contactGroupMembers.groupId, groupIds))
      : [];

    const membersMap = membersList.reduce<Record<string, typeof contacts.$inferSelect[]>>((acc, row) => {
      if (!acc[row.groupId]) acc[row.groupId] = [];
      acc[row.groupId].push(row.contact);
      return acc;
    }, {});

    const data = groups.map((g) => ({
      ...g,
      members: membersMap[g.id] ?? [],
      memberCount: (membersMap[g.id] ?? []).length,
    }));

    return NextResponse.json(data);
  } catch (err) {
    console.error("[GET /api/contact-groups]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = createGroupSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation error", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { name, description, contactIds } = parsed.data;
    const userId = session.user.id;

    const [group] = await db
      .insert(contactGroups)
      .values({
        ownerId: userId,
        name,
        description: description || null,
      })
      .returning();

    if (contactIds.length > 0) {
      const memberValues = contactIds.map((cId) => ({
        groupId: group.id,
        contactId: cId,
      }));
      await db.insert(contactGroupMembers).values(memberValues);
    }

    return NextResponse.json({ ...group, memberIds: contactIds }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/contact-groups]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
