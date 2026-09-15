import { describe, it, expect } from "vitest";
import { generateSigningToken } from "@/lib/tokens";

describe("Phase 4 — Signing Token Security", () => {
  it("generates cryptographically random 64-character hex token", () => {
    const token1 = generateSigningToken();
    const token2 = generateSigningToken();
    expect(token1).toHaveLength(64);
    expect(token2).toHaveLength(64);
    expect(token1).not.toBe(token2);
    expect(/^[a-f0-9]{64}$/.test(token1)).toBe(true);
  });
});

describe("Phase 4 — Status Lifecycle Rules", () => {
  const TERMINAL_STATUSES = ["COMPLETED", "DECLINED", "CANCELLED", "EXPIRED"];

  function isValidTransition(currentStatus: string, targetStatus: string): boolean {
    if (TERMINAL_STATUSES.includes(currentStatus)) return false;
    if (targetStatus === "DRAFT" && currentStatus !== "DRAFT") return false;
    return true;
  }

  it("prevents changing terminal status (COMPLETED, DECLINED, CANCELLED)", () => {
    expect(isValidTransition("COMPLETED", "SENT")).toBe(false);
    expect(isValidTransition("COMPLETED", "DRAFT")).toBe(false);
    expect(isValidTransition("DECLINED", "SENT")).toBe(false);
    expect(isValidTransition("CANCELLED", "DRAFT")).toBe(false);
  });

  it("prevents returning active envelopes to DRAFT", () => {
    expect(isValidTransition("SENT", "DRAFT")).toBe(false);
    expect(isValidTransition("PARTIALLY_SIGNED", "DRAFT")).toBe(false);
  });

  it("allows valid transitions", () => {
    expect(isValidTransition("DRAFT", "CANCELLED")).toBe(true);
    expect(isValidTransition("SENT", "COMPLETED")).toBe(true);
    expect(isValidTransition("SENT", "DECLINED")).toBe(true);
  });
});

describe("Phase 4 — Sequential Signer Turn Enforcement", () => {
  interface SignerMock {
    id: string;
    order: number;
    status: "PENDING" | "SENT" | "VIEWED" | "SIGNED" | "DECLINED";
  }

  function isSignerTurn(signers: SignerMock[], targetSignerId: string): boolean {
    const target = signers.find((s) => s.id === targetSignerId);
    if (!target) return false;
    if (target.order <= 1) return true;
    const lowerOrderSigners = signers.filter((s) => s.order < target.order);
    return lowerOrderSigners.every((s) => s.status === "SIGNED");
  }

  it("allows Signer 1 to sign immediately", () => {
    const signers: SignerMock[] = [
      { id: "signer-1", order: 1, status: "SENT" },
      { id: "signer-2", order: 2, status: "PENDING" },
    ];
    expect(isSignerTurn(signers, "signer-1")).toBe(true);
  });

  it("blocks Signer 2 while Signer 1 is still SENT or VIEWED", () => {
    const signers: SignerMock[] = [
      { id: "signer-1", order: 1, status: "VIEWED" },
      { id: "signer-2", order: 2, status: "PENDING" },
    ];
    expect(isSignerTurn(signers, "signer-2")).toBe(false);
  });

  it("allows Signer 2 to sign once Signer 1 has SIGNED", () => {
    const signers: SignerMock[] = [
      { id: "signer-1", order: 1, status: "SIGNED" },
      { id: "signer-2", order: 2, status: "SENT" },
    ];
    expect(isSignerTurn(signers, "signer-2")).toBe(true);
  });
});
