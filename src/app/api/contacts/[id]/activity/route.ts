import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { contacts } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { getContactActivity } from "@/lib/services/contacts";

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

    const [contact] = await db
      .select()
      .from(contacts)
      .where(and(eq(contacts.id, id), eq(contacts.ownerId, userId)))
      .limit(1);

    if (!contact) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }

    const activities = await getContactActivity(userId, contact.email);
    return NextResponse.json(activities);
  } catch (err) {
    console.error("[GET /api/contacts/[id]/activity]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
