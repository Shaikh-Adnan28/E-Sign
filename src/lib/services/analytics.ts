import { db } from "@/lib/db";
import {
  envelopes,
  signers,
  auditEvents,
  templates,
  contacts,
  bulkSendBatches,
  publicForms,
  publicFormSubmissions,
} from "@/lib/db/schema";
import { eq, and, gte, lte, sql, desc, inArray } from "drizzle-orm";

export type DateRangePreset = "today" | "7d" | "30d" | "90d" | "year" | "custom";

export interface DateRangeOptions {
  preset: DateRangePreset;
  startDate?: string | null;
  endDate?: string | null;
}

export interface DateRangeResult {
  currentStart: Date;
  currentEnd: Date;
  previousStart: Date;
  previousEnd: Date;
  daysCount: number;
}

/**
 * Parses date range preset or custom start/end strings into validated JS Date objects
 * for both current and equivalent previous comparison periods.
 */
export function parseDateRange(options: DateRangeOptions): DateRangeResult {
  const now = new Date();
  const preset = options.preset || "30d";

  let currentStart: Date;
  let currentEnd: Date = new Date(now);
  let daysCount = 30;

  if (preset === "today") {
    currentStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    currentEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    daysCount = 1;
  } else if (preset === "7d") {
    daysCount = 7;
    currentStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  } else if (preset === "90d") {
    daysCount = 90;
    currentStart = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  } else if (preset === "year") {
    currentStart = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
    daysCount = Math.max(1, Math.ceil((currentEnd.getTime() - currentStart.getTime()) / (1000 * 60 * 60 * 24)));
  } else if (preset === "custom" && options.startDate && options.endDate) {
    const parsedStart = new Date(options.startDate);
    const parsedEnd = new Date(options.endDate);

    if (!isNaN(parsedStart.getTime()) && !isNaN(parsedEnd.getTime()) && parsedStart <= parsedEnd) {
      currentStart = parsedStart;
      currentEnd = parsedEnd;
      daysCount = Math.max(1, Math.ceil((currentEnd.getTime() - currentStart.getTime()) / (1000 * 60 * 60 * 24)));
    } else {
      daysCount = 30;
      currentStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }
  } else {
    // Default 30d
    daysCount = 30;
    currentStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }

  const periodDurationMs = daysCount * 24 * 60 * 60 * 1000;
  const previousEnd = new Date(currentStart.getTime() - 1);
  const previousStart = new Date(previousEnd.getTime() - periodDurationMs);

  return {
    currentStart,
    currentEnd,
    previousStart,
    previousEnd,
    daysCount,
  };
}

import { formatDurationMs } from "@/lib/utils";

export { formatDurationMs };

/**
 * Calculates percentage difference between current and previous values.
 * Returns null if comparison is not meaningful or previous is 0.
 */
export function calculatePercentChange(current: number, previous: number): number | null {
  if (previous === 0) {
    return current > 0 ? 100 : 0;
  }
  const change = ((current - previous) / previous) * 100;
  return Math.round(change * 10) / 10;
}

export interface KPIOverview {
  sentCount: number;
  completedCount: number;
  pendingCount: number;
  declinedCount: number;
  expiredCount: number;
  completionRate: number | null; // null represents 0-eligible documents ("—")
  avgCompletionTimeMs: number | null;
  avgCompletionTimeFormatted: string;

  // Comparisons vs previous period
  prevSentCount: number;
  prevCompletedCount: number;
  prevCompletionRate: number | null;
  sentChangePercent: number | null;
  completedChangePercent: number | null;
  completionRateChangePercent: number | null;
}

/**
 * Fetches top-level KPI summary cards for the selected owner and date range.
 */
export async function getAnalyticsOverview(
  ownerId: string,
  options: DateRangeOptions
): Promise<KPIOverview> {
  const range = parseDateRange(options);

  // Fetch current period envelopes owned by user
  const currentEnvelopes = await db
    .select({
      id: envelopes.id,
      status: envelopes.status,
      createdAt: envelopes.createdAt,
      updatedAt: envelopes.updatedAt,
    })
    .from(envelopes)
    .where(
      and(
        eq(envelopes.ownerId, ownerId),
        gte(envelopes.createdAt, range.currentStart),
        lte(envelopes.createdAt, range.currentEnd)
      )
    );

  // Fetch previous period envelopes owned by user
  const previousEnvelopes = await db
    .select({
      id: envelopes.id,
      status: envelopes.status,
      createdAt: envelopes.createdAt,
      updatedAt: envelopes.updatedAt,
    })
    .from(envelopes)
    .where(
      and(
        eq(envelopes.ownerId, ownerId),
        gte(envelopes.createdAt, range.previousStart),
        lte(envelopes.createdAt, range.previousEnd)
      )
    );

  // Exclude DRAFT from sent count
  const nonDraftCurrent = currentEnvelopes.filter((e) => e.status !== "DRAFT");
  const nonDraftPrevious = previousEnvelopes.filter((e) => e.status !== "DRAFT");

  const sentCount = nonDraftCurrent.length;
  const completedCount = nonDraftCurrent.filter((e) => e.status === "COMPLETED").length;
  const pendingCount = nonDraftCurrent.filter((e) =>
    ["SENT", "DELIVERED", "VIEWED", "PARTIALLY_SIGNED"].includes(e.status)
  ).length;
  const declinedCount = nonDraftCurrent.filter((e) => e.status === "DECLINED").length;
  const expiredCount = nonDraftCurrent.filter((e) => e.status === "EXPIRED").length;

  const completionRate = sentCount > 0 ? Math.round((completedCount / sentCount) * 1000) / 10 : null;

  // Calculate average completion time for completed envelopes in current period
  const completedCurrentList = nonDraftCurrent.filter(
    (e) => e.status === "COMPLETED" && e.createdAt && e.updatedAt
  );

  let totalDurationMs = 0;
  for (const env of completedCurrentList) {
    const startMs = new Date(env.createdAt!).getTime();
    const endMs = new Date(env.updatedAt!).getTime();
    if (endMs >= startMs) {
      totalDurationMs += endMs - startMs;
    }
  }

  const avgCompletionTimeMs =
    completedCurrentList.length > 0 ? Math.round(totalDurationMs / completedCurrentList.length) : null;
  const avgCompletionTimeFormatted = formatDurationMs(avgCompletionTimeMs);

  // Previous period metrics
  const prevSentCount = nonDraftPrevious.length;
  const prevCompletedCount = nonDraftPrevious.filter((e) => e.status === "COMPLETED").length;
  const prevCompletionRate =
    prevSentCount > 0 ? Math.round((prevCompletedCount / prevSentCount) * 1000) / 10 : null;

  const sentChangePercent = calculatePercentChange(sentCount, prevSentCount);
  const completedChangePercent = calculatePercentChange(completedCount, prevCompletedCount);
  const completionRateChangePercent =
    completionRate !== null && prevCompletionRate !== null
      ? calculatePercentChange(completionRate, prevCompletionRate)
      : null;

  return {
    sentCount,
    completedCount,
    pendingCount,
    declinedCount,
    expiredCount,
    completionRate,
    avgCompletionTimeMs,
    avgCompletionTimeFormatted,
    prevSentCount,
    prevCompletedCount,
    prevCompletionRate,
    sentChangePercent,
    completedChangePercent,
    completionRateChangePercent,
  };
}

export interface TimeSeriesBucket {
  date: string; // YYYY-MM-DD
  sent: number;
  completed: number;
  declined: number;
  expired: number;
}

/**
 * Aggregates time-series document activity grouped by day or week.
 */
export async function getAnalyticsActivity(
  ownerId: string,
  options: DateRangeOptions
): Promise<TimeSeriesBucket[]> {
  const range = parseDateRange(options);
  const useWeekly = range.daysCount > 60;
  const truncUnit = useWeekly ? "week" : "day";

  // Query aggregated envelope counts grouped by truncated date
  const rows = await db
    .select({
      bucketDate: sql<string>`TO_CHAR(DATE_TRUNC(${sql.raw(`'${truncUnit}'`)}, ${envelopes.createdAt}), 'YYYY-MM-DD')`,
      status: envelopes.status,
      count: sql<number>`CAST(COUNT(*) AS INTEGER)`,
    })
    .from(envelopes)
    .where(
      and(
        eq(envelopes.ownerId, ownerId),
        gte(envelopes.createdAt, range.currentStart),
        lte(envelopes.createdAt, range.currentEnd),
        sql`${envelopes.status} != 'DRAFT'`
      )
    )
    .groupBy(sql`DATE_TRUNC(${sql.raw(`'${truncUnit}'`)}, ${envelopes.createdAt})`);

  // Build bucket map
  const bucketMap = new Map<string, { sent: number; completed: number; declined: number; expired: number }>();

  // Initialize dates in range to 0
  const curr = new Date(range.currentStart);
  while (curr <= range.currentEnd) {
    const dStr = curr.toISOString().slice(0, 10);
    bucketMap.set(dStr, { sent: 0, completed: 0, declined: 0, expired: 0 });
    curr.setDate(curr.getDate() + (useWeekly ? 7 : 1));
  }

  for (const row of rows) {
    if (!row.bucketDate) continue;
    const existing = bucketMap.get(row.bucketDate) || { sent: 0, completed: 0, declined: 0, expired: 0 };

    existing.sent += Number(row.count);
    if (row.status === "COMPLETED") existing.completed += Number(row.count);
    if (row.status === "DECLINED") existing.declined += Number(row.count);
    if (row.status === "EXPIRED") existing.expired += Number(row.count);

    bucketMap.set(row.bucketDate, existing);
  }

  const sortedResult: TimeSeriesBucket[] = Array.from(bucketMap.entries())
    .map(([date, counts]) => ({
      date,
      sent: counts.sent,
      completed: counts.completed,
      declined: counts.declined,
      expired: counts.expired,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return sortedResult;
}

export interface TemplateAnalyticsItem {
  id: string;
  name: string;
  filename: string;
  usageCount: number;
  completedCount: number;
  pendingCount: number;
  completionRate: number | null;
  avgCompletionTimeFormatted: string;
  lastUsedAt: Date | null;
}

/**
 * Fetches template usage and completion performance stats.
 */
export async function getTemplateAnalytics(
  ownerId: string,
  options: DateRangeOptions
): Promise<TemplateAnalyticsItem[]> {
  const range = parseDateRange(options);

  const userTemplates = await db
    .select({
      id: templates.id,
      name: templates.name,
      filename: templates.filename,
      usageCount: templates.usageCount,
      updatedAt: templates.updatedAt,
    })
    .from(templates)
    .where(and(eq(templates.ownerId, ownerId), eq(templates.status, "ACTIVE")))
    .orderBy(desc(templates.usageCount));

  if (userTemplates.length === 0) return [];

  const result: TemplateAnalyticsItem[] = [];

  for (const t of userTemplates) {
    const matchingEnvelopes = await db
      .select({
        id: envelopes.id,
        status: envelopes.status,
        createdAt: envelopes.createdAt,
        updatedAt: envelopes.updatedAt,
      })
      .from(envelopes)
      .where(
        and(
          eq(envelopes.ownerId, ownerId),
          sql`${envelopes.title} LIKE ${`%${t.name}%`}`,
          gte(envelopes.createdAt, range.currentStart),
          lte(envelopes.createdAt, range.currentEnd)
        )
      );

    const completed = matchingEnvelopes.filter((e) => e.status === "COMPLETED");
    const pending = matchingEnvelopes.filter((e) =>
      ["SENT", "DELIVERED", "VIEWED", "PARTIALLY_SIGNED"].includes(e.status)
    );

    const total = matchingEnvelopes.length;
    const completionRate = total > 0 ? Math.round((completed.length / total) * 1000) / 10 : null;

    let totalDurationMs = 0;
    for (const env of completed) {
      if (env.createdAt && env.updatedAt) {
        totalDurationMs += new Date(env.updatedAt).getTime() - new Date(env.createdAt).getTime();
      }
    }
    const avgMs = completed.length > 0 ? Math.round(totalDurationMs / completed.length) : null;

    result.push({
      id: t.id,
      name: t.name,
      filename: t.filename,
      usageCount: t.usageCount,
      completedCount: completed.length,
      pendingCount: pending.length,
      completionRate,
      avgCompletionTimeFormatted: formatDurationMs(avgMs),
      lastUsedAt: t.updatedAt,
    });
  }

  return result;
}

export interface ContactAnalyticsItem {
  id: string;
  name: string;
  email: string;
  company: string | null;
  usageCount: number;
  totalSent: number;
  completedCount: number;
  completionRate: number | null;
  lastUsedAt: Date | null;
}

/**
 * Fetches contact usage & recipient completion analytics.
 */
export async function getContactAnalytics(
  ownerId: string,
  options: DateRangeOptions
): Promise<ContactAnalyticsItem[]> {
  const range = parseDateRange(options);

  const ownerContacts = await db
    .select()
    .from(contacts)
    .where(eq(contacts.ownerId, ownerId))
    .orderBy(desc(contacts.usageCount))
    .limit(20);

  if (ownerContacts.length === 0) return [];

  const result: ContactAnalyticsItem[] = [];

  for (const c of ownerContacts) {
    const signerRows = await db
      .select({
        status: signers.status,
        envelopeStatus: envelopes.status,
      })
      .from(signers)
      .innerJoin(envelopes, eq(signers.envelopeId, envelopes.id))
      .where(
        and(
          eq(envelopes.ownerId, ownerId),
          eq(signers.email, c.email),
          gte(envelopes.createdAt, range.currentStart),
          lte(envelopes.createdAt, range.currentEnd)
        )
      );

    const totalSent = signerRows.length;
    const completedCount = signerRows.filter((s) => s.status === "SIGNED" || s.envelopeStatus === "COMPLETED").length;
    const completionRate = totalSent > 0 ? Math.round((completedCount / totalSent) * 1000) / 10 : null;

    result.push({
      id: c.id,
      name: c.name,
      email: c.email,
      company: c.company,
      usageCount: c.usageCount,
      totalSent,
      completedCount,
      completionRate,
      lastUsedAt: c.lastUsedAt,
    });
  }

  return result;
}

export interface BulkSendAnalyticsSummary {
  totalBatches: number;
  totalRows: number;
  sentRows: number;
  failedRows: number;
  pendingRows: number;
  completionRate: number | null;
  failureRate: number | null;
  recentBatches: Array<{
    id: string;
    name: string;
    status: string;
    totalRows: number;
    sentRows: number;
    failedRows: number;
    createdAt: Date | null;
  }>;
}

/**
 * Fetches Bulk Send batch analytics & row statistics.
 */
export async function getBulkSendAnalytics(
  ownerId: string,
  options: DateRangeOptions
): Promise<BulkSendAnalyticsSummary> {
  const range = parseDateRange(options);

  const batches = await db
    .select()
    .from(bulkSendBatches)
    .where(
      and(
        eq(bulkSendBatches.ownerId, ownerId),
        gte(bulkSendBatches.createdAt, range.currentStart),
        lte(bulkSendBatches.createdAt, range.currentEnd)
      )
    )
    .orderBy(desc(bulkSendBatches.createdAt));

  const totalBatches = batches.length;
  let totalRows = 0;
  let sentRows = 0;
  let failedRows = 0;
  let pendingRows = 0;

  for (const b of batches) {
    totalRows += b.totalRows;
    sentRows += b.sentRows;
    failedRows += b.failedRows;
    pendingRows += b.pendingRows + b.processingRows;
  }

  const completionRate = totalRows > 0 ? Math.round((sentRows / totalRows) * 1000) / 10 : null;
  const failureRate = totalRows > 0 ? Math.round((failedRows / totalRows) * 1000) / 10 : null;

  const recentBatches = batches.slice(0, 5).map((b) => ({
    id: b.id,
    name: b.name,
    status: b.status,
    totalRows: b.totalRows,
    sentRows: b.sentRows,
    failedRows: b.failedRows,
    createdAt: b.createdAt,
  }));

  return {
    totalBatches,
    totalRows,
    sentRows,
    failedRows,
    pendingRows,
    completionRate,
    failureRate,
    recentBatches,
  };
}

export interface PublicFormAnalyticsSummary {
  activeFormsCount: number;
  totalSubmissions: number;
  startedCount: number;
  completedCount: number;
  declinedCount: number;
  expiredCount: number;
  conversionRate: number | null;
  forms: Array<{
    id: string;
    name: string;
    status: string;
    token: string;
    submissionsCount: number;
    completedCount: number;
    conversionRate: number | null;
    updatedAt: Date | null;
  }>;
}

/**
 * Fetches Public Forms funnel analytics & per-form submission metrics.
 */
export async function getPublicFormAnalytics(
  ownerId: string,
  options: DateRangeOptions
): Promise<PublicFormAnalyticsSummary> {
  const range = parseDateRange(options);

  const forms = await db
    .select()
    .from(publicForms)
    .where(and(eq(publicForms.ownerId, ownerId), sql`${publicForms.status} != 'ARCHIVED'`))
    .orderBy(desc(publicForms.createdAt));

  const activeFormsCount = forms.filter((f) => f.status === "ACTIVE").length;

  // Query submissions across owner's forms within date range
  const formIds = forms.map((f) => f.id);
  if (formIds.length === 0) {
    return {
      activeFormsCount: 0,
      totalSubmissions: 0,
      startedCount: 0,
      completedCount: 0,
      declinedCount: 0,
      expiredCount: 0,
      conversionRate: null,
      forms: [],
    };
  }

  const submissions = await db
    .select({
      publicFormId: publicFormSubmissions.publicFormId,
      status: publicFormSubmissions.status,
      envelopeStatus: envelopes.status,
    })
    .from(publicFormSubmissions)
    .leftJoin(envelopes, eq(publicFormSubmissions.envelopeId, envelopes.id))
    .where(
      and(
        inArray(publicFormSubmissions.publicFormId, formIds),
        gte(publicFormSubmissions.submittedAt, range.currentStart),
        lte(publicFormSubmissions.submittedAt, range.currentEnd)
      )
    );

  const totalSubmissions = submissions.length;
  const startedCount = totalSubmissions;
  const completedCount = submissions.filter(
    (s) => s.status === "COMPLETED" || s.envelopeStatus === "COMPLETED"
  ).length;
  const declinedCount = submissions.filter(
    (s) => s.status === "DECLINED" || s.envelopeStatus === "DECLINED"
  ).length;
  const expiredCount = submissions.filter(
    (s) => s.status === "EXPIRED" || s.envelopeStatus === "EXPIRED"
  ).length;

  const conversionRate = totalSubmissions > 0 ? Math.round((completedCount / totalSubmissions) * 1000) / 10 : null;

  const formItems = forms.map((f) => {
    const fSubs = submissions.filter((s) => s.publicFormId === f.id);
    const fComp = fSubs.filter((s) => s.status === "COMPLETED" || s.envelopeStatus === "COMPLETED").length;
    const cRate = fSubs.length > 0 ? Math.round((fComp / fSubs.length) * 1000) / 10 : null;

    return {
      id: f.id,
      name: f.name,
      status: f.status,
      token: f.token,
      submissionsCount: f.submissionsCount,
      completedCount: fComp,
      conversionRate: cRate,
      updatedAt: f.updatedAt,
    };
  });

  return {
    activeFormsCount,
    totalSubmissions,
    startedCount,
    completedCount,
    declinedCount,
    expiredCount,
    conversionRate,
    forms: formItems,
  };
}

export interface ReminderAnalyticsSummary {
  autoRemindersSent: number;
  manualRemindersSent: number;
  totalRemindersSent: number;
  awaitingActionCount: number;
  avgRemindersPerCompletedEnvelope: number | null;
}

/**
 * Fetches reminder activity metrics from audit events.
 */
export async function getReminderAnalytics(
  ownerId: string,
  options: DateRangeOptions
): Promise<ReminderAnalyticsSummary> {
  const range = parseDateRange(options);

  // Fetch reminder audit events
  const reminderEvents = await db
    .select({
      event: auditEvents.event,
      envelopeId: auditEvents.envelopeId,
    })
    .from(auditEvents)
    .innerJoin(envelopes, eq(auditEvents.envelopeId, envelopes.id))
    .where(
      and(
        eq(envelopes.ownerId, ownerId),
        gte(auditEvents.createdAt, range.currentStart),
        lte(auditEvents.createdAt, range.currentEnd),
        sql`${auditEvents.event} LIKE 'REMINDER_%'`
      )
    );

  let autoRemindersSent = 0;
  let manualRemindersSent = 0;

  for (const e of reminderEvents) {
    if (e.event === "REMINDER_SENT_AUTOMATIC" || e.event === "REMINDER_SENT") {
      autoRemindersSent++;
    } else if (e.event === "REMINDER_SENT_MANUAL") {
      manualRemindersSent++;
    } else {
      autoRemindersSent++;
    }
  }

  const totalRemindersSent = autoRemindersSent + manualRemindersSent;

  // Awaiting action count: envelopes currently in SENT / VIEWED / PARTIALLY_SIGNED state
  const awaitingRows = await db
    .select({ count: sql<number>`CAST(COUNT(*) AS INTEGER)` })
    .from(envelopes)
    .where(
      and(
        eq(envelopes.ownerId, ownerId),
        inArray(envelopes.status, ["SENT", "DELIVERED", "VIEWED", "PARTIALLY_SIGNED"])
      )
    );

  const awaitingActionCount = Number(awaitingRows[0]?.count ?? 0);

  // Average reminders per completed envelope
  const completedEnvelopes = await db
    .select({ id: envelopes.id })
    .from(envelopes)
    .where(and(eq(envelopes.ownerId, ownerId), eq(envelopes.status, "COMPLETED")));

  let avgRemindersPerCompletedEnvelope: number | null = null;
  if (completedEnvelopes.length > 0) {
    const completedIds = completedEnvelopes.map((e) => e.id);
    const completedReminders = reminderEvents.filter((r) => r.envelopeId && completedIds.includes(r.envelopeId));
    avgRemindersPerCompletedEnvelope = Math.round((completedReminders.length / completedEnvelopes.length) * 10) / 10;
  }

  return {
    autoRemindersSent,
    manualRemindersSent,
    totalRemindersSent,
    awaitingActionCount,
    avgRemindersPerCompletedEnvelope,
  };
}

export interface ActivityStreamItem {
  id: string;
  envelopeId: string | null;
  envelopeTitle: string | null;
  event: string;
  actor: string | null;
  createdAt: Date | null;
}

/**
 * Fetches recent audit event stream for user.
 */
export async function getRecentActivity(ownerId: string, limit = 15): Promise<ActivityStreamItem[]> {
  const events = await db
    .select({
      id: auditEvents.id,
      envelopeId: auditEvents.envelopeId,
      event: auditEvents.event,
      actor: auditEvents.actor,
      createdAt: auditEvents.createdAt,
      envelopeTitle: envelopes.title,
    })
    .from(auditEvents)
    .leftJoin(envelopes, eq(auditEvents.envelopeId, envelopes.id))
    .where(and(eq(envelopes.ownerId, ownerId)))
    .orderBy(desc(auditEvents.createdAt))
    .limit(limit);

  return events;
}

/**
 * Generates CSV string report for requested section.
 */
export async function exportAnalyticsReportCSV(
  ownerId: string,
  section: string,
  options: DateRangeOptions
): Promise<string> {
  const range = parseDateRange(options);

  if (section === "documents" || section === "summary") {
    const userEnvelopes = await db
      .select({
        title: envelopes.title,
        status: envelopes.status,
        createdAt: envelopes.createdAt,
        updatedAt: envelopes.updatedAt,
      })
      .from(envelopes)
      .where(
        and(
          eq(envelopes.ownerId, ownerId),
          gte(envelopes.createdAt, range.currentStart),
          lte(envelopes.createdAt, range.currentEnd)
        )
      )
      .orderBy(desc(envelopes.createdAt));

    const lines = ["Title,Status,Created At,Updated At"];
    for (const env of userEnvelopes) {
      const titleClean = `"${(env.title || "").replace(/"/g, '""')}"`;
      const cDate = env.createdAt ? new Date(env.createdAt).toISOString() : "";
      const uDate = env.updatedAt ? new Date(env.updatedAt).toISOString() : "";
      lines.push(`${titleClean},${env.status},${cDate},${uDate}`);
    }
    return lines.join("\n");
  }

  if (section === "templates") {
    const tmplStats = await getTemplateAnalytics(ownerId, options);
    const lines = ["Template Name,Filename,Usage Count,Completed Envelopes,Pending Envelopes,Completion Rate (%),Avg Completion Time"];
    for (const t of tmplStats) {
      const nameClean = `"${t.name.replace(/"/g, '""')}"`;
      const fileClean = `"${t.filename.replace(/"/g, '""')}"`;
      lines.push(`${nameClean},${fileClean},${t.usageCount},${t.completedCount},${t.pendingCount},${t.completionRate ?? "N/A"},${t.avgCompletionTimeFormatted}`);
    }
    return lines.join("\n");
  }

  if (section === "contacts") {
    const contactStats = await getContactAnalytics(ownerId, options);
    const lines = ["Contact Name,Email,Company,Usage Count,Total Sent,Completed Count,Completion Rate (%)"];
    for (const c of contactStats) {
      const nameClean = `"${c.name.replace(/"/g, '""')}"`;
      const companyClean = `"${(c.company || "").replace(/"/g, '""')}"`;
      lines.push(`${nameClean},${c.email},${companyClean},${c.usageCount},${c.totalSent},${c.completedCount},${c.completionRate ?? "N/A"}`);
    }
    return lines.join("\n");
  }

  if (section === "bulk_send") {
    const bulkStats = await getBulkSendAnalytics(ownerId, options);
    const lines = ["Batch Name,Status,Total Rows,Sent Rows,Failed Rows,Created At"];
    for (const b of bulkStats.recentBatches) {
      const nameClean = `"${b.name.replace(/"/g, '""')}"`;
      const cDate = b.createdAt ? new Date(b.createdAt).toISOString() : "";
      lines.push(`${nameClean},${b.status},${b.totalRows},${b.sentRows},${b.failedRows},${cDate}`);
    }
    return lines.join("\n");
  }

  if (section === "public_forms") {
    const pfStats = await getPublicFormAnalytics(ownerId, options);
    const lines = ["Form Name,Status,Token,Submissions Count,Completed Submissions,Conversion Rate (%)"];
    for (const f of pfStats.forms) {
      const nameClean = `"${f.name.replace(/"/g, '""')}"`;
      lines.push(`${nameClean},${f.status},${f.token},${f.submissionsCount},${f.completedCount},${f.conversionRate ?? "N/A"}`);
    }
    return lines.join("\n");
  }

  // Default summary export
  const overview = await getAnalyticsOverview(ownerId, options);
  const summaryLines = [
    "Metric,Value,Previous Period,Change (%)",
    `Documents Sent,${overview.sentCount},${overview.prevSentCount},${overview.sentChangePercent ?? "N/A"}%`,
    `Completed Documents,${overview.completedCount},${overview.prevCompletedCount},${overview.completedChangePercent ?? "N/A"}%`,
    `Pending Documents,${overview.pendingCount},N/A,N/A`,
    `Declined Documents,${overview.declinedCount},N/A,N/A`,
    `Expired Documents,${overview.expiredCount},N/A,N/A`,
    `Completion Rate,${overview.completionRate !== null ? overview.completionRate + "%" : "N/A"},${overview.prevCompletionRate !== null ? overview.prevCompletionRate + "%" : "N/A"},${overview.completionRateChangePercent ?? "N/A"}%`,
    `Average Completion Time,${overview.avgCompletionTimeFormatted},N/A,N/A`,
  ];
  return summaryLines.join("\n");
}
