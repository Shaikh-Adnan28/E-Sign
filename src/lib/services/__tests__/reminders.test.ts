import { describe, it, expect } from "vitest";

describe("Phase 6.0 — Reminders & Expiration Mechanics", () => {
  interface SignerMock {
    id: string;
    email: string;
    name?: string;
    order: number;
    status: "PENDING" | "SENT" | "DELIVERED" | "VIEWED" | "SIGNED" | "DECLINED" | "EXPIRED";
  }

  interface EnvelopeMock {
    id: string;
    status: string;
    reminderEnabled: boolean;
    reminderFirstAfterDays: number;
    reminderEveryDays: number;
    reminderMessage: string | null;
    nextReminderAt: Date | null;
    lastReminderAt: Date | null;
    expiresAt: Date | null;
    expirationWarningDays: number | null;
    expirationWarningSentAt: Date | null;
  }

  function getActiveSignersForReminder(signers: SignerMock[]): SignerMock[] {
    const pendingSigners = signers.filter(
      (s) => !["SIGNED", "DECLINED", "EXPIRED"].includes(s.status)
    );

    if (pendingSigners.length === 0) return [];

    const minPendingOrder = Math.min(...pendingSigners.map((s) => s.order));
    return pendingSigners.filter((s) => s.order === minPendingOrder);
  }

  function checkEnvelopeExpired(envelope: EnvelopeMock, now: Date): boolean {
    if (envelope.status === "EXPIRED") return true;
    if (envelope.expiresAt && envelope.expiresAt <= now) return true;
    return false;
  }

  function shouldSendExpirationWarning(envelope: EnvelopeMock, now: Date): boolean {
    if (
      !envelope.expiresAt ||
      !envelope.expirationWarningDays ||
      envelope.expirationWarningSentAt !== null
    ) {
      return false;
    }

    if (["COMPLETED", "DECLINED", "EXPIRED", "CANCELLED"].includes(envelope.status)) {
      return false;
    }

    const warningThresholdMs = envelope.expirationWarningDays * 24 * 60 * 60 * 1000;
    const msUntilExpiration = envelope.expiresAt.getTime() - now.getTime();

    return msUntilExpiration > 0 && msUntilExpiration <= warningThresholdMs;
  }

  it("targets only active order signers in sequential signing workflows", () => {
    const signers: SignerMock[] = [
      { id: "s1", email: "first@example.com", order: 1, status: "SIGNED" },
      { id: "s2", email: "second@example.com", order: 2, status: "SENT" },
      { id: "s3", email: "third@example.com", order: 3, status: "PENDING" },
    ];

    const toRemind = getActiveSignersForReminder(signers);

    expect(toRemind).toHaveLength(1);
    expect(toRemind[0].email).toBe("second@example.com");
  });

  it("targets all pending signers in parallel signing workflows (equal order)", () => {
    const signers: SignerMock[] = [
      { id: "s1", email: "signer1@example.com", order: 1, status: "SENT" },
      { id: "s2", email: "signer2@example.com", order: 1, status: "DELIVERED" },
      { id: "s3", email: "signer3@example.com", order: 1, status: "SIGNED" },
    ];

    const toRemind = getActiveSignersForReminder(signers);

    expect(toRemind).toHaveLength(2);
    expect(toRemind.map((s) => s.email)).toEqual(["signer1@example.com", "signer2@example.com"]);
  });

  it("correctly identifies expired envelopes past deadline", () => {
    const now = new Date("2026-09-15T12:00:00Z");

    const activeEnv: EnvelopeMock = {
      id: "env-1",
      status: "SENT",
      reminderEnabled: true,
      reminderFirstAfterDays: 2,
      reminderEveryDays: 3,
      reminderMessage: null,
      nextReminderAt: new Date("2026-09-16T12:00:00Z"),
      lastReminderAt: null,
      expiresAt: new Date("2026-09-20T12:00:00Z"),
      expirationWarningDays: 3,
      expirationWarningSentAt: null,
    };

    const expiredEnv: EnvelopeMock = {
      ...activeEnv,
      expiresAt: new Date("2026-09-14T12:00:00Z"),
    };

    expect(checkEnvelopeExpired(activeEnv, now)).toBe(false);
    expect(checkEnvelopeExpired(expiredEnv, now)).toBe(true);
  });

  it("triggers expiration warnings when threshold window is breached", () => {
    const now = new Date("2026-09-15T12:00:00Z");

    // Expiring in 2 days (warning threshold is 3 days) -> Should trigger
    const envDueForWarning: EnvelopeMock = {
      id: "env-warn",
      status: "SENT",
      reminderEnabled: true,
      reminderFirstAfterDays: 2,
      reminderEveryDays: 3,
      reminderMessage: null,
      nextReminderAt: null,
      lastReminderAt: null,
      expiresAt: new Date("2026-09-17T12:00:00Z"),
      expirationWarningDays: 3,
      expirationWarningSentAt: null,
    };

    expect(shouldSendExpirationWarning(envDueForWarning, now)).toBe(true);

    // Already sent warning -> Should not trigger again
    const envAlreadyWarned: EnvelopeMock = {
      ...envDueForWarning,
      expirationWarningSentAt: new Date("2026-09-14T12:00:00Z"),
    };
    expect(shouldSendExpirationWarning(envAlreadyWarned, now)).toBe(false);
  });
});
