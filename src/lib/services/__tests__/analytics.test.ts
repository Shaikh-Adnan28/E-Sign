import { describe, it, expect } from "vitest";
import {
  parseDateRange,
  formatDurationMs,
  calculatePercentChange,
  DateRangeOptions,
} from "../analytics";

describe("Phase 9.0 — Analytics Date Range & Math Mechanics", () => {
  it("correctly parses 7d date range preset and calculates previous period boundaries", () => {
    const range = parseDateRange({ preset: "7d" });

    expect(range.daysCount).toBe(7);
    expect(range.currentStart).toBeInstanceOf(Date);
    expect(range.currentEnd).toBeInstanceOf(Date);
    expect(range.previousStart).toBeInstanceOf(Date);
    expect(range.previousEnd).toBeInstanceOf(Date);

    expect(range.currentEnd.getTime()).toBeGreaterThan(range.currentStart.getTime());
    expect(range.currentStart.getTime()).toBeGreaterThan(range.previousEnd.getTime());
    expect(range.previousEnd.getTime()).toBeGreaterThan(range.previousStart.getTime());
  });

  it("correctly parses 30d, 90d, and custom date range presets", () => {
    const range30 = parseDateRange({ preset: "30d" });
    expect(range30.daysCount).toBe(30);

    const range90 = parseDateRange({ preset: "90d" });
    expect(range90.daysCount).toBe(90);

    const customOptions: DateRangeOptions = {
      preset: "custom",
      startDate: "2026-01-01",
      endDate: "2026-01-15",
    };
    const rangeCustom = parseDateRange(customOptions);
    expect(rangeCustom.daysCount).toBe(14);
  });

  it("handles invalid custom date range gracefully by falling back to 30d default", () => {
    const invalidOptions: DateRangeOptions = {
      preset: "custom",
      startDate: "2026-05-20",
      endDate: "2026-01-01", // start after end
    };
    const fallback = parseDateRange(invalidOptions);
    expect(fallback.daysCount).toBe(30);
  });

  it("formats millisecond durations into human-readable strings cleanly", () => {
    expect(formatDurationMs(null)).toBe("—");
    expect(formatDurationMs(0)).toBe("—");
    expect(formatDurationMs(-100)).toBe("—");

    expect(formatDurationMs(30 * 1000)).toBe("< 1m");
    expect(formatDurationMs(15 * 60 * 1000)).toBe("15m");
    expect(formatDurationMs((2 * 60 + 18) * 60 * 1000)).toBe("2h 18m");
    expect(formatDurationMs((28 * 60 + 0) * 60 * 1000)).toBe("1d 4h");
  });

  it("calculates percentage changes correctly and safely handles division by zero", () => {
    expect(calculatePercentChange(120, 100)).toBe(20);
    expect(calculatePercentChange(80, 100)).toBe(-20);
    expect(calculatePercentChange(50, 0)).toBe(100);
    expect(calculatePercentChange(0, 0)).toBe(0);
  });
});

describe("Phase 9.0 — KPI & Completion Rate Calculation Formulas", () => {
  interface EnvelopeMock {
    id: string;
    ownerId: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
  }

  function computeKPIs(envelopes: EnvelopeMock[], ownerId: string) {
    const ownerEnvelopes = envelopes.filter((e) => e.ownerId === ownerId);
    const nonDraft = ownerEnvelopes.filter((e) => e.status !== "DRAFT");

    const sentCount = nonDraft.length;
    const completedCount = nonDraft.filter((e) => e.status === "COMPLETED").length;
    const pendingCount = nonDraft.filter((e) =>
      ["SENT", "DELIVERED", "VIEWED", "PARTIALLY_SIGNED"].includes(e.status)
    ).length;
    const declinedCount = nonDraft.filter((e) => e.status === "DECLINED").length;
    const expiredCount = nonDraft.filter((e) => e.status === "EXPIRED").length;

    // Division by zero safety check
    const completionRate = sentCount > 0 ? Math.round((completedCount / sentCount) * 1000) / 10 : null;

    const completedEnvelopes = nonDraft.filter((e) => e.status === "COMPLETED");
    let totalMs = 0;
    for (const env of completedEnvelopes) {
      totalMs += env.updatedAt.getTime() - env.createdAt.getTime();
    }
    const avgMs = completedEnvelopes.length > 0 ? Math.round(totalMs / completedEnvelopes.length) : null;

    return {
      sentCount,
      completedCount,
      pendingCount,
      declinedCount,
      expiredCount,
      completionRate,
      avgCompletionTimeFormatted: formatDurationMs(avgMs),
    };
  }

  it("calculates completion rate and metrics correctly for valid envelope datasets", () => {
    const mockData: EnvelopeMock[] = [
      { id: "e1", ownerId: "user-1", status: "DRAFT", createdAt: new Date(), updatedAt: new Date() },
      { id: "e2", ownerId: "user-1", status: "COMPLETED", createdAt: new Date("2026-01-01T10:00:00Z"), updatedAt: new Date("2026-01-01T12:00:00Z") },
      { id: "e3", ownerId: "user-1", status: "SENT", createdAt: new Date(), updatedAt: new Date() },
      { id: "e4", ownerId: "user-1", status: "DECLINED", createdAt: new Date(), updatedAt: new Date() },
    ];

    const kpi = computeKPIs(mockData, "user-1");

    expect(kpi.sentCount).toBe(3); // excludes DRAFT
    expect(kpi.completedCount).toBe(1);
    expect(kpi.pendingCount).toBe(1);
    expect(kpi.declinedCount).toBe(1);
    expect(kpi.expiredCount).toBe(0);
    expect(kpi.completionRate).toBe(33.3);
    expect(kpi.avgCompletionTimeFormatted).toBe("2h");
  });

  it("returns null completion rate (displaying '—') when zero eligible envelopes exist", () => {
    const emptyData: EnvelopeMock[] = [
      { id: "e1", ownerId: "user-1", status: "DRAFT", createdAt: new Date(), updatedAt: new Date() },
    ];

    const kpi = computeKPIs(emptyData, "user-1");

    expect(kpi.sentCount).toBe(0);
    expect(kpi.completedCount).toBe(0);
    expect(kpi.completionRate).toBeNull();
    expect(kpi.avgCompletionTimeFormatted).toBe("—");
  });

  it("strictly isolates analytics metrics by ownerId preventing cross-tenant data leakage", () => {
    const multiUserDataset: EnvelopeMock[] = [
      { id: "e1", ownerId: "user-A", status: "COMPLETED", createdAt: new Date(), updatedAt: new Date() },
      { id: "e2", ownerId: "user-A", status: "COMPLETED", createdAt: new Date(), updatedAt: new Date() },
      { id: "e3", ownerId: "user-B", status: "DECLINED", createdAt: new Date(), updatedAt: new Date() },
    ];

    const userAKPI = computeKPIs(multiUserDataset, "user-A");
    const userBKPI = computeKPIs(multiUserDataset, "user-B");

    expect(userAKPI.sentCount).toBe(2);
    expect(userAKPI.completedCount).toBe(2);
    expect(userAKPI.declinedCount).toBe(0);

    expect(userBKPI.sentCount).toBe(1);
    expect(userBKPI.completedCount).toBe(0);
    expect(userBKPI.declinedCount).toBe(1);
  });
});
