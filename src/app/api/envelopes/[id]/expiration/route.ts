import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { envelopes, auditEvents } from "@/lib/db/schema";
import { auth } from "@/lib/auth";
import { eq, and } from "drizzle-orm";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();

    const [envelope] = await db
      .select()
      .from(envelopes)
      .where(and(eq(envelopes.id, id), eq(envelopes.ownerId, session.user.id)))
      .limit(1);

    if (!envelope) {
      return NextResponse.json({ error: "Envelope not found" }, { status: 404 });
    }

    if (["COMPLETED", "DECLINED", "EXPIRED", "CANCELLED"].includes(envelope.status)) {
      return NextResponse.json(
        { error: "Cannot modify expiration or reminders for terminal envelopes" },
        { status: 400 }
      );
    }

    const now = new Date();
    const updateData: Partial<typeof envelopes.$inferInsert> = {
      updatedAt: now,
    };

    if (body.expiresAt !== undefined) {
      updateData.expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;
    } else if (typeof body.expirationDays === "number") {
      updateData.expiresAt = new Date(now.getTime() + body.expirationDays * 24 * 60 * 60 * 1000);
    }

    if (typeof body.expirationWarningDays === "number") {
      updateData.expirationWarningDays = body.expirationWarningDays;
      // Reset sent flag if threshold extended
      updateData.expirationWarningSentAt = null;
    }

    if (typeof body.reminderEnabled === "boolean") {
      updateData.reminderEnabled = body.reminderEnabled;
    }

    if (typeof body.reminderFirstAfterDays === "number") {
      updateData.reminderFirstAfterDays = body.reminderFirstAfterDays;
    }

    if (typeof body.reminderEveryDays === "number") {
      updateData.reminderEveryDays = body.reminderEveryDays;
    }

    if (body.reminderMessage !== undefined) {
      updateData.reminderMessage = body.reminderMessage;
    }

    // Recalculate nextReminderAt if reminder is enabled and envelope is active
    const isEnabled = updateData.reminderEnabled ?? envelope.reminderEnabled;
    const isActive = ["SENT", "DELIVERED", "VIEWED", "PARTIALLY_SIGNED"].includes(envelope.status);

    if (isEnabled && isActive) {
      const firstAfter = updateData.reminderFirstAfterDays ?? envelope.reminderFirstAfterDays ?? 2;
      const last = envelope.lastReminderAt ?? envelope.updatedAt ?? now;
      const every = updateData.reminderEveryDays ?? envelope.reminderEveryDays ?? 3;

      if (!envelope.lastReminderAt) {
        updateData.nextReminderAt = new Date(now.getTime() + firstAfter * 24 * 60 * 60 * 1000);
      } else {
        updateData.nextReminderAt = new Date(last.getTime() + every * 24 * 60 * 60 * 1000);
      }
    } else if (!isEnabled) {
      updateData.nextReminderAt = null;
    }

    const [updated] = await db
      .update(envelopes)
      .set(updateData)
      .where(eq(envelopes.id, id))
      .returning();

    await db.insert(auditEvents).values({
      envelopeId: id,
      event: "SETTINGS_UPDATED",
      actor: session.user.email ?? session.user.id,
      meta: {
        updatedFields: Object.keys(updateData),
        expiresAt: updated.expiresAt?.toISOString(),
        reminderEnabled: updated.reminderEnabled,
      },
    });

    return NextResponse.json({ success: true, envelope: updated });
  } catch (err) {
    console.error("[PATCH /api/envelopes/[id]/expiration]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
