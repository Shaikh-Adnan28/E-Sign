import { db } from "@/lib/db";
import { envelopes, signers, users, auditEvents } from "@/lib/db/schema";
import { eq, and, lte, inArray, isNotNull, isNull, gt } from "drizzle-orm";
import { sendExpirationWarningEmail, sendEnvelopeExpiredEmail } from "@/lib/email";

export interface ExpirationProcessResult {
  processedCount: number;
  notifiedCount: number;
  errors: string[];
}

export interface ExpirationWarningProcessResult {
  warnedEnvelopesCount: number;
  errors: string[];
}

/**
 * Service to process expired envelopes.
 * Transitions active envelopes past their expiration date to EXPIRED, updates pending signers,
 * clears nextReminderAt, sends notification emails, and records audit logs.
 */
export async function processExpiredEnvelopes(): Promise<ExpirationProcessResult> {
  const now = new Date();
  const errors: string[] = [];
  let processedCount = 0;
  let notifiedCount = 0;

  const expiredEnvelopes = await db
    .select({ envelope: envelopes, owner: users })
    .from(envelopes)
    .innerJoin(users, eq(envelopes.ownerId, users.id))
    .where(
      and(
        isNotNull(envelopes.expiresAt),
        lte(envelopes.expiresAt, now),
        inArray(envelopes.status, ["SENT", "DELIVERED", "VIEWED", "PARTIALLY_SIGNED"])
      )
    );

  for (const { envelope, owner } of expiredEnvelopes) {
    try {
      // Mark envelope as EXPIRED and disable future reminders
      await db
        .update(envelopes)
        .set({
          status: "EXPIRED",
          nextReminderAt: null,
          updatedAt: now,
        })
        .where(eq(envelopes.id, envelope.id));

      // Fetch all signers
      const envelopeSigners = await db
        .select()
        .from(signers)
        .where(eq(signers.envelopeId, envelope.id));

      // Update pending signers to EXPIRED status
      const pendingSigners = envelopeSigners.filter(
        (s) => !s.status || !["SIGNED", "DECLINED"].includes(s.status)
      );

      for (const signer of pendingSigners) {
        await db
          .update(signers)
          .set({ status: "EXPIRED" })
          .where(eq(signers.id, signer.id));
      }

      // Send email notification to envelope owner
      await sendEnvelopeExpiredEmail({
        to: owner.email,
        name: owner.name ?? owner.email,
        documentTitle: envelope.title,
        isSender: true,
      });
      notifiedCount++;

      // Send email notifications to signers
      for (const signer of envelopeSigners) {
        if (signer.email !== owner.email) {
          await sendEnvelopeExpiredEmail({
            to: signer.email,
            name: signer.name ?? signer.email,
            documentTitle: envelope.title,
            isSender: false,
          });
          notifiedCount++;
        }
      }

      // Record audit event
      await db.insert(auditEvents).values({
        envelopeId: envelope.id,
        event: "DOCUMENT_EXPIRED",
        actor: "SYSTEM_SCHEDULER",
        meta: {
          expiredAt: now.toISOString(),
          originalExpiresAt: envelope.expiresAt?.toISOString(),
        },
      });

      processedCount++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[processExpiredEnvelopes] Error processing envelope ${envelope.id}:`, msg);
      errors.push(`Envelope ${envelope.id}: ${msg}`);
    }
  }

  return { processedCount, notifiedCount, errors };
}

/**
 * Service to process expiration warning notifications.
 * Sends warning emails to signers of envelopes expiring within expirationWarningDays.
 */
export async function processExpirationWarnings(): Promise<ExpirationWarningProcessResult> {
  const now = new Date();
  const errors: string[] = [];
  let warnedEnvelopesCount = 0;

  const candidateEnvelopes = await db
    .select({ envelope: envelopes, owner: users })
    .from(envelopes)
    .innerJoin(users, eq(envelopes.ownerId, users.id))
    .where(
      and(
        isNotNull(envelopes.expiresAt),
        isNotNull(envelopes.expirationWarningDays),
        isNull(envelopes.expirationWarningSentAt),
        gt(envelopes.expiresAt, now),
        inArray(envelopes.status, ["SENT", "DELIVERED", "VIEWED", "PARTIALLY_SIGNED"])
      )
    );

  for (const { envelope, owner } of candidateEnvelopes) {
    try {
      if (!envelope.expiresAt || !envelope.expirationWarningDays) continue;

      const warningThresholdMs = envelope.expirationWarningDays * 24 * 60 * 60 * 1000;
      const msUntilExpiration = envelope.expiresAt.getTime() - now.getTime();

      if (msUntilExpiration <= warningThresholdMs) {
        // Find active pending signers
        const envelopeSigners = await db
          .select()
          .from(signers)
          .where(eq(signers.envelopeId, envelope.id))
          .orderBy(signers.order);

        const pendingSigners = envelopeSigners.filter(
          (s) => !s.status || !["SIGNED", "DECLINED", "EXPIRED"].includes(s.status)
        );

        if (pendingSigners.length > 0) {
          const minPendingOrder = Math.min(...pendingSigners.map((s) => s.order ?? 0));
          const activeSignersToWarn = pendingSigners.filter(
            (s) => (s.order ?? 0) === minPendingOrder
          );

          const daysRemaining = Math.max(1, Math.ceil(msUntilExpiration / (24 * 60 * 60 * 1000)));
          const senderName = owner.name ?? owner.email;

          for (const signer of activeSignersToWarn) {
            await sendExpirationWarningEmail({
              to: signer.email,
              signerName: signer.name ?? signer.email,
              senderName,
              documentTitle: envelope.title,
              token: signer.token,
              daysRemaining,
              expiresAt: envelope.expiresAt,
            });
          }

          // Mark warning as sent
          await db
            .update(envelopes)
            .set({
              expirationWarningSentAt: now,
              updatedAt: now,
            })
            .where(eq(envelopes.id, envelope.id));

          await db.insert(auditEvents).values({
            envelopeId: envelope.id,
            event: "EXPIRATION_WARNING_SENT",
            actor: "SYSTEM_SCHEDULER",
            meta: {
              daysRemaining,
              expiresAt: envelope.expiresAt.toISOString(),
              signersWarned: activeSignersToWarn.map((s) => s.email),
            },
          });

          warnedEnvelopesCount++;
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[processExpirationWarnings] Error processing envelope ${envelope.id}:`, msg);
      errors.push(`Envelope ${envelope.id}: ${msg}`);
    }
  }

  return { warnedEnvelopesCount, errors };
}
