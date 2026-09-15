import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { contactGroups, contactGroupMembers, contacts } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

const patchGroupSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  contactIds: z.array(z.string().uuid()).optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const userId = session.user.id;

    const [group] = await db
      .select()
      .from(contactGroups)
      .where(and(eq(contactGroups.id, id), eq(contactGroups.ownerId, userId)))
      .limit(1);

    if (!group) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    const members = await db
      .select({ contact: contacts })
      .from(contactGroupMembers)
      .innerJoin(contacts, eq(contactGroupMembers.contactId, contacts.id))
      .where(eq(contactGroupMembers.groupId, id));

    return NextResponse.json({
      ...group,
      members: members.map((m) => m.contact),
    });
  } catch (err) {
    console.error("[GET /api/contact-groups/[id]]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const userId = session.user.id;
    const body = await req.json();

    const parsed = patchGroupSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation error", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const [existing] = await db
      .select()
      .from(contactGroups)
      .where(and(eq(contactGroups.id, id), eq(contactGroups.ownerId, userId)))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    const { name, description, contactIds } = parsed.data;

    const updateData: Partial<typeof contactGroups.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;

    const [updated] = await db
      .update(contactGroups)
      .set(updateData)
      .where(eq(contactGroups.id, id))
      .returning();

    if (contactIds !== undefined) {
      await db.delete(contactGroupMembers).where(eq(contactGroupMembers.groupId, id));
      if (contactIds.length > 0) {
        const memberValues = contactIds.map((cId) => ({
          groupId: id,
          contactId: cId,
        }));
        await db.insert(contactGroupMembers).values(memberValues);
      }
    }

    return NextResponse.json(updated);
  } catch (err) {
    console.error("[PATCH /api/contact-groups/[id]]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const userId = session.user.id;

    const [existing] = await db
      .select()
      .from(contactGroups)
      .where(and(eq(contactGroups.id, id), eq(contactGroups.ownerId, userId)))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    await db.delete(contactGroups).where(eq(contactGroups.id, id));

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[DELETE /api/contact-groups/[id]]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
