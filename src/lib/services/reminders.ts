import { db } from "@/lib/db";
import { envelopes, signers, users, auditEvents } from "@/lib/db/schema";
import { eq, and, lte, inArray, isNotNull } from "drizzle-orm";
import { sendReminderEmail } from "@/lib/email";

export interface ReminderProcessResult {
  processedEnvelopesCount: number;
  sentRemindersCount: number;
  errors: string[];
}

/**
 * Server-side service to find and process due automatic envelope reminders.
 * Idempotent: Updates nextReminderAt before sending to prevent duplicate sends on concurrent executions.
 */
export async function processDueReminders(): Promise<ReminderProcessResult> {
  const now = new Date();
  const errors: string[] = [];
  let sentRemindersCount = 0;

  // 1. Query active envelopes where reminders are enabled and nextReminderAt <= now
  const dueEnvelopes = await db
    .select({ envelope: envelopes, owner: users })
    .from(envelopes)
    .innerJoin(users, eq(envelopes.ownerId, users.id))
    .where(
      and(
        eq(envelopes.reminderEnabled, true),
        isNotNull(envelopes.nextReminderAt),
        lte(envelopes.nextReminderAt, now),
        inArray(envelopes.status, ["SENT", "DELIVERED", "VIEWED", "PARTIALLY_SIGNED"])
      )
    );

  let processedEnvelopesCount = 0;

  for (const { envelope, owner } of dueEnvelopes) {
    try {
      // Check expiration first — if expired, skip reminder and let expiration handler process it
      if (envelope.expiresAt && envelope.expiresAt <= now) {
        continue;
      }

      // Fetch all signers for this envelope sorted by order
      const envelopeSigners = await db
        .select()
        .from(signers)
        .where(eq(signers.envelopeId, envelope.id))
        .orderBy(signers.order);

      if (envelopeSigners.length === 0) continue;

      // Filter non-signed signers
      const pendingSigners = envelopeSigners.filter(
        (s) => !s.status || !["SIGNED", "DECLINED", "EXPIRED"].includes(s.status)
      );

      if (pendingSigners.length === 0) continue;

      // Sequential check: Find minimum order among pending signers
      const minPendingOrder = Math.min(...pendingSigners.map((s) => s.order ?? 0));

      // Active signers eligible for reminder
      const activeSignersToRemind = pendingSigners.filter(
        (s) => (s.order ?? 0) === minPendingOrder
      );

      // Atomic update of reminder schedule to prevent duplicate execution
      const nextReminderDate = new Date(
        now.getTime() + (envelope.reminderEveryDays || 3) * 24 * 60 * 60 * 1000
      );

      await db
        .update(envelopes)
        .set({
          lastReminderAt: now,
          nextReminderAt: nextReminderDate,
          updatedAt: now,
        })
        .where(eq(envelopes.id, envelope.id));

      const senderName = owner.name ?? owner.email;

      for (const signer of activeSignersToRemind) {
        await sendReminderEmail({
          to: signer.email,
          signerName: signer.name ?? signer.email,
          senderName,
          documentTitle: envelope.title,
          token: signer.token,
          customMessage: envelope.reminderMessage,
        });
        sentRemindersCount++;
      }

      await db.insert(auditEvents).values({
        envelopeId: envelope.id,
        event: "REMINDER_SENT",
        actor: "SYSTEM_SCHEDULER",
        meta: {
          type: "AUTOMATIC",
          signersReminded: activeSignersToRemind.map((s) => s.email),
          nextReminderAt: nextReminderDate.toISOString(),
        },
      });

      processedEnvelopesCount++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[processDueReminders] Error processing envelope ${envelope.id}:`, msg);
      errors.push(`Envelope ${envelope.id}: ${msg}`);
    }
  }

  return { processedEnvelopesCount, sentRemindersCount, errors };
}

/**
 * Triggers a manual "Send Reminder Now" action for a specific envelope.
 */
export async function sendManualReminder(envelopeId: string, ownerId: string): Promise<{ success: boolean; count: number }> {
  const now = new Date();

  const [envelope] = await db
    .select({ envelope: envelopes, owner: users })
    .from(envelopes)
    .innerJoin(users, eq(envelopes.ownerId, users.id))
    .where(and(eq(envelopes.id, envelopeId), eq(envelopes.ownerId, ownerId)))
    .limit(1);

  if (!envelope) throw new Error("Envelope not found or unauthorized");

  const env = envelope.envelope;

  if (!["SENT", "DELIVERED", "VIEWED", "PARTIALLY_SIGNED"].includes(env.status)) {
    throw new Error("Reminders can only be sent for active documents");
  }

  if (env.expiresAt && env.expiresAt <= now) {
    throw new Error("Cannot send reminders for an expired document");
  }

  const envelopeSigners = await db
    .select()
    .from(signers)
    .where(eq(signers.envelopeId, env.id))
    .orderBy(signers.order);

  const pendingSigners = envelopeSigners.filter(
    (s) => !["SIGNED", "DECLINED", "EXPIRED"].includes(s.status)
  );

  if (pendingSigners.length === 0) {
    throw new Error("No pending recipients to remind");
  }

  const minPendingOrder = Math.min(...pendingSigners.map((s) => s.order ?? 0));
  const activeSignersToRemind = pendingSigners.filter(
    (s) => (s.order ?? 0) === minPendingOrder
  );

  const senderName = envelope.owner.name ?? envelope.owner.email;

  for (const signer of activeSignersToRemind) {
    await sendReminderEmail({
      to: signer.email,
      signerName: signer.name ?? signer.email,
      senderName,
      documentTitle: env.title,
      token: signer.token,
      customMessage: env.reminderMessage,
    });
  }

  // Update lastReminderAt and recalculate nextReminderAt if automatic reminders are enabled
  const updateData: Partial<typeof envelopes.$inferInsert> = {
    lastReminderAt: now,
    updatedAt: now,
  };

  if (env.reminderEnabled) {
    updateData.nextReminderAt = new Date(
      now.getTime() + (env.reminderEveryDays || 3) * 24 * 60 * 60 * 1000
    );
  }

  await db.update(envelopes).set(updateData).where(eq(envelopes.id, env.id));

  await db.insert(auditEvents).values({
    envelopeId: env.id,
    event: "REMINDER_SENT",
    actor: envelope.owner.email,
    meta: {
      type: "MANUAL",
      signersReminded: activeSignersToRemind.map((s) => s.email),
    },
  });

  return { success: true, count: activeSignersToRemind.length };
}
