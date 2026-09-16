"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  BarChart2,
  RefreshCw,
  Download,
  Send,
  CheckCircle2,
  Clock,
  XCircle,
  AlertTriangle,
  PieChart,
  Timer,
  Bell,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  ExternalLink,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export interface AnalyticsClientProps {
  user?: {
    id?: string;
    name?: string | null;
    email?: string | null;
  };
}

export type PresetType = "today" | "7d" | "30d" | "90d" | "year" | "custom";

interface KPIOverview {
  sentCount: number;
  completedCount: number;
  pendingCount: number;
  declinedCount: number;
  expiredCount: number;
  completionRate: number | null;
  avgCompletionTimeMs: number | null;
  avgCompletionTimeFormatted: string;
  prevSentCount: number;
  prevCompletedCount: number;
  prevCompletionRate: number | null;
  sentChangePercent: number | null;
  completedChangePercent: number | null;
  completionRateChangePercent: number | null;
}

interface TimeBucket {
  date: string;
  sent: number;
  completed: number;
  declined: number;
  expired: number;
}

interface TemplateItem {
  id: string;
  name: string;
  filename: string;
  usageCount: number;
  completedCount: number;
  pendingCount: number;
  completionRate: number | null;
  avgCompletionTimeFormatted: string;
  lastUsedAt: string | null;
}

interface ContactItem {
  id: string;
  name: string;
  email: string;
  company: string | null;
  usageCount: number;
  totalSent: number;
  completedCount: number;
  completionRate: number | null;
  lastUsedAt: string | null;
}

interface BulkSendSummary {
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
    createdAt: string | null;
  }>;
}

interface PublicFormSummary {
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
    updatedAt: string | null;
  }>;
}

interface ReminderSummary {
  autoRemindersSent: number;
  manualRemindersSent: number;
  totalRemindersSent: number;
  awaitingActionCount: number;
  avgRemindersPerCompletedEnvelope: number | null;
}

interface ActivityItem {
  id: string;
  envelopeId: string | null;
  envelopeTitle: string | null;
  event: string;
  actor: string | null;
  createdAt: string | null;
}

export function AnalyticsClient({ user }: AnalyticsClientProps) {
  const [preset, setPreset] = useState<PresetType>("30d");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [showCustomModal, setShowCustomModal] = useState(false);

  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<KPIOverview | null>(null);
  const [activity, setActivity] = useState<TimeBucket[]>([]);
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [contacts, setContacts] = useState<ContactItem[]>([]);
  const [bulkSend, setBulkSend] = useState<BulkSendSummary | null>(null);
  const [publicForms, setPublicForms] = useState<PublicFormSummary | null>(null);
  const [reminders, setReminders] = useState<ReminderSummary | null>(null);
  const [recentEvents, setRecentEvents] = useState<ActivityItem[]>([]);

  const [activeTab, setActiveTab] = useState<"overview" | "templates" | "contacts" | "bulk_send" | "public_forms" | "reminders">("overview");

  // Export Modal state
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportSection, setExportSection] = useState("summary");

  const buildQueryString = useCallback(() => {
    const params = new URLSearchParams();
    params.set("preset", preset);
    if (preset === "custom" && startDate && endDate) {
      params.set("startDate", startDate);
      params.set("endDate", endDate);
    }
    return params.toString();
  }, [preset, startDate, endDate]);

  const fetchAllAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      const q = buildQueryString();

      const [
        ovRes,
        actRes,
        tmplRes,
        cntRes,
        bulkRes,
        pfRes,
        remRes,
        evRes,
      ] = await Promise.all([
        fetch(`/api/analytics/overview?${q}`),
        fetch(`/api/analytics/activity?${q}`),
        fetch(`/api/analytics/templates?${q}`),
        fetch(`/api/analytics/contacts?${q}`),
        fetch(`/api/analytics/bulk-send?${q}`),
        fetch(`/api/analytics/public-forms?${q}`),
        fetch(`/api/analytics/reminders?${q}`),
        fetch(`/api/analytics/recent-activity?limit=10`),
      ]);

      const [ov, act, tmpl, cnt, bulk, pf, rem, ev] = await Promise.all([
        ovRes.json(),
        actRes.json(),
        tmplRes.json(),
        cntRes.json(),
        bulkRes.json(),
        pfRes.json(),
        remRes.json(),
        evRes.json(),
      ]);

      if (ov.overview) setOverview(ov.overview);
      if (act.activity) setActivity(act.activity);
      if (tmpl.templates) setTemplates(tmpl.templates);
      if (cnt.contacts) setContacts(cnt.contacts);
      if (bulk.bulkSend) setBulkSend(bulk.bulkSend);
      if (pf.publicForms) setPublicForms(pf.publicForms);
      if (rem.reminders) setReminders(rem.reminders);
      if (ev.activity) setRecentEvents(ev.activity);
    } catch (err) {
      console.error("Failed to load analytics data:", err);
    } finally {
      setLoading(false);
    }
  }, [buildQueryString]);

  useEffect(() => {
    let ignore = false;
    async function loadData() {
      const q = buildQueryString();
      try {
        const [
          ovRes,
          actRes,
          tmplRes,
          cntRes,
          bulkRes,
          pfRes,
          remRes,
          evRes,
        ] = await Promise.all([
          fetch(`/api/analytics/overview?${q}`),
          fetch(`/api/analytics/activity?${q}`),
          fetch(`/api/analytics/templates?${q}`),
          fetch(`/api/analytics/contacts?${q}`),
          fetch(`/api/analytics/bulk-send?${q}`),
          fetch(`/api/analytics/public-forms?${q}`),
          fetch(`/api/analytics/reminders?${q}`),
          fetch(`/api/analytics/recent-activity?limit=10`),
        ]);

        const [ov, act, tmpl, cnt, bulk, pf, rem, ev] = await Promise.all([
          ovRes.json(),
          actRes.json(),
          tmplRes.json(),
          cntRes.json(),
          bulkRes.json(),
          pfRes.json(),
          remRes.json(),
          evRes.json(),
        ]);

        if (!ignore) {
          if (ov.overview) setOverview(ov.overview);
          if (act.activity) setActivity(act.activity);
          if (tmpl.templates) setTemplates(tmpl.templates);
          if (cnt.contacts) setContacts(cnt.contacts);
          if (bulk.bulkSend) setBulkSend(bulk.bulkSend);
          if (pf.publicForms) setPublicForms(pf.publicForms);
          if (rem.reminders) setReminders(rem.reminders);
          if (ev.activity) setRecentEvents(ev.activity);
          setLoading(false);
        }
      } catch (err) {
        console.error("Failed to load analytics:", err);
      }
    }

    loadData();

    return () => {
      ignore = true;
    };
  }, [buildQueryString]);

  const handleExportCSV = () => {
    const q = buildQueryString();
    window.open(`/api/analytics/export?section=${exportSection}&${q}`, "_blank");
    setShowExportModal(false);
  };

  const handleApplyCustomRange = (e: React.FormEvent) => {
    e.preventDefault();
    if (startDate && endDate) {
      setPreset("custom");
      setShowCustomModal(false);
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto px-4 py-8">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
              <BarChart2 className="h-6 w-6" />
            </div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Analytics & Performance
            </h1>
          </div>
          <p className="text-slate-600 text-sm">
            {user?.name
              ? `Overview for ${user.name} — understand how your documents, templates, contacts, and workflows are performing.`
              : "Understand how your documents, templates, contacts, and signing workflows are performing."}
          </p>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Preset Selector */}
          <div className="relative">
            <select
              value={preset}
              onChange={(e) => {
                const val = e.target.value as PresetType;
                if (val === "custom") {
                  setShowCustomModal(true);
                } else {
                  setPreset(val);
                }
              }}
              className="bg-white border border-slate-300 text-slate-800 text-xs font-semibold px-3 py-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm cursor-pointer"
            >
              <option value="today">Today</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
              <option value="year">This year</option>
              <option value="custom">
                {preset === "custom" && startDate && endDate
                  ? `${startDate} - ${endDate}`
                  : "Custom Range..."}
              </option>
            </select>
          </div>

          <Button
            onClick={fetchAllAnalytics}
            variant="outline"
            size="sm"
            disabled={loading}
            className="border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-medium h-9 rounded-xl"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin text-blue-600" : "text-slate-500"}`} />
            Refresh
          </Button>

          <Button
            onClick={() => setShowExportModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold h-9 px-4 rounded-xl shadow-sm flex items-center gap-1.5"
          >
            <Download className="h-3.5 w-3.5" />
            Export Report
          </Button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Sent Card */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Documents Sent</span>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <Send className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900">
              {loading ? "—" : overview?.sentCount ?? 0}
            </div>
            <div className="flex items-center justify-between text-xs mt-1">
              <span className="text-slate-500">Non-draft envelopes</span>
              {overview?.sentChangePercent !== null && (
                <span
                  className={`inline-flex items-center font-semibold text-[11px] ${
                    (overview?.sentChangePercent ?? 0) >= 0 ? "text-emerald-600" : "text-red-600"
                  }`}
                >
                  {(overview?.sentChangePercent ?? 0) >= 0 ? (
                    <ArrowUpRight className="h-3 w-3 mr-0.5" />
                  ) : (
                    <ArrowDownRight className="h-3 w-3 mr-0.5" />
                  )}
                  {Math.abs(overview?.sentChangePercent ?? 0)}% vs prev
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Completed Card */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Completed</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900">
              {loading ? "—" : overview?.completedCount ?? 0}
            </div>
            <div className="flex items-center justify-between text-xs mt-1">
              <span className="text-slate-500">Fully signed</span>
              {overview?.completedChangePercent !== null && (
                <span
                  className={`inline-flex items-center font-semibold text-[11px] ${
                    (overview?.completedChangePercent ?? 0) >= 0 ? "text-emerald-600" : "text-red-600"
                  }`}
                >
                  {(overview?.completedChangePercent ?? 0) >= 0 ? (
                    <ArrowUpRight className="h-3 w-3 mr-0.5" />
                  ) : (
                    <ArrowDownRight className="h-3 w-3 mr-0.5" />
                  )}
                  {Math.abs(overview?.completedChangePercent ?? 0)}% vs prev
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Pending Card */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Pending / In Progress</span>
            <div className="p-2 bg-sky-50 text-sky-600 rounded-lg">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900">
              {loading ? "—" : overview?.pendingCount ?? 0}
            </div>
            <div className="text-xs text-slate-500 mt-1">Awaiting signer action</div>
          </div>
        </div>

        {/* Completion Rate Card */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Completion Rate</span>
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <PieChart className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900">
              {loading
                ? "—"
                : overview?.completionRate !== null
                ? `${overview?.completionRate}%`
                : "—"}
            </div>
            <div className="flex items-center justify-between text-xs mt-1">
              <span className="text-slate-500">Completed / Sent</span>
              {overview?.completionRateChangePercent !== null && (
                <span
                  className={`inline-flex items-center font-semibold text-[11px] ${
                    (overview?.completionRateChangePercent ?? 0) >= 0 ? "text-emerald-600" : "text-red-600"
                  }`}
                >
                  {(overview?.completionRateChangePercent ?? 0) >= 0 ? (
                    <ArrowUpRight className="h-3 w-3 mr-0.5" />
                  ) : (
                    <ArrowDownRight className="h-3 w-3 mr-0.5" />
                  )}
                  {Math.abs(overview?.completionRateChangePercent ?? 0)}% vs prev
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Secondary KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="p-2.5 bg-red-50 text-red-600 rounded-lg">
            <XCircle className="h-5 w-5" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-500 block">Declined Documents</span>
            <span className="text-lg font-bold text-slate-900">
              {loading ? "—" : overview?.declinedCount ?? 0}
            </span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="p-2.5 bg-amber-50 text-amber-600 rounded-lg">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-500 block">Expired Documents</span>
            <span className="text-lg font-bold text-slate-900">
              {loading ? "—" : overview?.expiredCount ?? 0}
            </span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
          <div className="p-2.5 bg-purple-50 text-purple-600 rounded-lg">
            <Timer className="h-5 w-5" />
          </div>
          <div>
            <span className="text-xs font-semibold text-slate-500 block">Avg Completion Time</span>
            <span className="text-lg font-bold text-slate-900">
              {loading ? "—" : overview?.avgCompletionTimeFormatted ?? "—"}
            </span>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Activity Over Time Chart */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">Document Activity Over Time</h3>
              <p className="text-xs text-slate-500">Sent vs Completed trends across selected range</p>
            </div>
            <div className="flex items-center gap-4 text-xs font-medium">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-blue-500 inline-block" />
                <span className="text-slate-600">Sent</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" />
                <span className="text-slate-600">Completed</span>
              </div>
            </div>
          </div>

          {/* SVG Line / Bar Chart */}
          <div className="h-64 w-full pt-4 relative">
            {activity.length === 0 || activity.every((a) => a.sent === 0 && a.completed === 0) ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
                No document activity recorded in this period.
              </div>
            ) : (
              <div className="h-full flex items-end justify-between gap-1.5 border-b border-slate-200 pb-2 px-2">
                {activity.map((b) => {
                  const maxVal = Math.max(...activity.map((x) => Math.max(x.sent, x.completed)), 1);
                  const sentH = Math.max(8, Math.round((b.sent / maxVal) * 100));
                  const compH = Math.max(4, Math.round((b.completed / maxVal) * 100));

                  return (
                    <div
                      key={b.date}
                      className="flex-1 flex flex-col items-center justify-end h-full group relative"
                    >
                      {/* Tooltip */}
                      <div className="absolute bottom-full mb-2 hidden group-hover:flex flex-col items-center z-10 bg-slate-900 text-white text-[10px] rounded px-2 py-1 shadow-lg whitespace-nowrap pointer-events-none">
                        <span className="font-semibold">{b.date}</span>
                        <span>Sent: {b.sent} • Completed: {b.completed}</span>
                      </div>

                      <div className="w-full flex items-end justify-center gap-1 max-w-[28px]">
                        <div
                          style={{ height: `${sentH}%` }}
                          className="w-1/2 bg-blue-500 rounded-t hover:bg-blue-600 transition-all"
                        />
                        <div
                          style={{ height: `${compH}%` }}
                          className="w-1/2 bg-emerald-500 rounded-t hover:bg-emerald-600 transition-all"
                        />
                      </div>
                      <span className="text-[9px] text-slate-400 mt-1 truncate max-w-full">
                        {b.date.slice(5)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Status Distribution Donut Chart */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">Document Status Breakdown</h3>
            <p className="text-xs text-slate-500">Distribution by envelope status</p>
          </div>

          <div className="space-y-3 pt-2">
            <StatusDistributionBar
              label="Completed"
              count={overview?.completedCount ?? 0}
              total={overview?.sentCount ?? 1}
              colorBg="bg-emerald-500"
              colorText="text-emerald-700"
            />
            <StatusDistributionBar
              label="Pending / In Progress"
              count={overview?.pendingCount ?? 0}
              total={overview?.sentCount ?? 1}
              colorBg="bg-blue-500"
              colorText="text-blue-700"
            />
            <StatusDistributionBar
              label="Declined"
              count={overview?.declinedCount ?? 0}
              total={overview?.sentCount ?? 1}
              colorBg="bg-red-500"
              colorText="text-red-700"
            />
            <StatusDistributionBar
              label="Expired"
              count={overview?.expiredCount ?? 0}
              total={overview?.sentCount ?? 1}
              colorBg="bg-amber-500"
              colorText="text-amber-700"
            />
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 space-x-6">
        <button
          onClick={() => setActiveTab("overview")}
          className={`pb-3 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === "overview"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          Overview & Audit Stream
        </button>
        <button
          onClick={() => setActiveTab("templates")}
          className={`pb-3 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === "templates"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          Template Performance ({templates.length})
        </button>
        <button
          onClick={() => setActiveTab("contacts")}
          className={`pb-3 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === "contacts"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          Contact Usage ({contacts.length})
        </button>
        <button
          onClick={() => setActiveTab("bulk_send")}
          className={`pb-3 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === "bulk_send"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          Bulk Send
        </button>
        <button
          onClick={() => setActiveTab("public_forms")}
          className={`pb-3 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === "public_forms"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          Public Forms Funnel
        </button>
      </div>

      {/* Tab Contents */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Recent Audit Activity Stream */}
          <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-blue-600" />
                <h3 className="text-base font-bold text-slate-900">Live Activity Stream</h3>
              </div>
              <span className="text-xs text-slate-500">Real-time audit log</span>
            </div>

            {recentEvents.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                No recent activity recorded yet.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {recentEvents.map((ev) => (
                  <div key={ev.id} className="py-3 flex items-center justify-between gap-4">
                    <div className="space-y-0.5">
                      <div className="text-xs font-semibold text-slate-900 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-blue-500" />
                        <span>{ev.event.replace(/_/g, " ")}</span>
                      </div>
                      <p className="text-xs text-slate-600">
                        {ev.envelopeTitle ? `"${ev.envelopeTitle}"` : "Envelope Workflow"}{" "}
                        {ev.actor ? `by ${ev.actor}` : ""}
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-[11px] text-slate-400">
                        {ev.createdAt ? new Date(ev.createdAt).toLocaleTimeString() : ""}
                      </span>
                      {ev.envelopeId && (
                        <Link
                          href={`/dashboard/documents/${ev.envelopeId}`}
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium inline-flex items-center gap-0.5"
                        >
                          View <ChevronRight className="h-3 w-3" />
                        </Link>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Summary Cards */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-purple-600" />
              <h3 className="text-base font-bold text-slate-900">Reminders Summary</h3>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                <span className="text-slate-600 font-medium">Automatic Reminders Sent</span>
                <span className="font-bold text-slate-900">{reminders?.autoRemindersSent ?? 0}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                <span className="text-slate-600 font-medium">Manual Reminders Sent</span>
                <span className="font-bold text-slate-900">{reminders?.manualRemindersSent ?? 0}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                <span className="text-slate-600 font-medium">Awaiting Signer Action</span>
                <span className="font-bold text-slate-900">{reminders?.awaitingActionCount ?? 0}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "templates" && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900 text-base">Template Usage & Completion Performance</h3>
              <p className="text-xs text-slate-500">Ranked by usage count</p>
            </div>
          </div>

          {templates.length === 0 ? (
            <div className="p-12 text-center text-slate-500 text-xs">No active templates found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-500 uppercase">
                  <tr>
                    <th className="px-6 py-3">Template Name</th>
                    <th className="px-6 py-3">Usage Count</th>
                    <th className="px-6 py-3">Completed Envelopes</th>
                    <th className="px-6 py-3">Completion Rate</th>
                    <th className="px-6 py-3">Avg Duration</th>
                    <th className="px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {templates.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-6 py-4 font-semibold text-slate-900">{t.name}</td>
                      <td className="px-6 py-4">{t.usageCount}</td>
                      <td className="px-6 py-4">{t.completedCount}</td>
                      <td className="px-6 py-4 font-medium text-emerald-700">
                        {t.completionRate !== null ? `${t.completionRate}%` : "—"}
                      </td>
                      <td className="px-6 py-4">{t.avgCompletionTimeFormatted}</td>
                      <td className="px-6 py-4 text-right">
                        <Link
                          href={`/dashboard/templates/editor/${t.id}`}
                          className="inline-flex items-center gap-1 text-blue-600 font-semibold hover:underline"
                        >
                          <span>Open Template</span>
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === "contacts" && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-200">
            <h3 className="font-bold text-slate-900 text-base">Frequently Contacted Signers</h3>
            <p className="text-xs text-slate-500">Recipient contact activity & completion rates</p>
          </div>

          {contacts.length === 0 ? (
            <div className="p-12 text-center text-slate-500 text-xs">No contact analytics data available.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-500 uppercase">
                  <tr>
                    <th className="px-6 py-3">Contact Name / Email</th>
                    <th className="px-6 py-3">Company</th>
                    <th className="px-6 py-3">Usage Count</th>
                    <th className="px-6 py-3">Documents Sent</th>
                    <th className="px-6 py-3">Completed</th>
                    <th className="px-6 py-3">Completion Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {contacts.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-semibold text-slate-900">{c.name}</div>
                        <div className="text-[11px] text-slate-400">{c.email}</div>
                      </td>
                      <td className="px-6 py-4">{c.company || "—"}</td>
                      <td className="px-6 py-4">{c.usageCount}</td>
                      <td className="px-6 py-4">{c.totalSent}</td>
                      <td className="px-6 py-4">{c.completedCount}</td>
                      <td className="px-6 py-4 font-medium text-emerald-700">
                        {c.completionRate !== null ? `${c.completionRate}%` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === "bulk_send" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-xs text-slate-500 font-semibold block">Total Batches</span>
              <span className="text-xl font-bold text-slate-900">{bulkSend?.totalBatches ?? 0}</span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-xs text-slate-500 font-semibold block">Total Batch Recipients</span>
              <span className="text-xl font-bold text-slate-900">{bulkSend?.totalRows ?? 0}</span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-xs text-slate-500 font-semibold block">Successful Sends</span>
              <span className="text-xl font-bold text-emerald-600">{bulkSend?.sentRows ?? 0}</span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-xs text-slate-500 font-semibold block">Failed Rows</span>
              <span className="text-xl font-bold text-red-600">{bulkSend?.failedRows ?? 0}</span>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <h3 className="font-bold text-slate-900 text-base">Recent Bulk Send Batches</h3>
            {bulkSend?.recentBatches.length === 0 ? (
              <p className="text-xs text-slate-400">No bulk send batches found.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {bulkSend?.recentBatches.map((b) => (
                  <div key={b.id} className="py-3 flex items-center justify-between gap-4 text-xs">
                    <div>
                      <div className="font-bold text-slate-900">{b.name}</div>
                      <div className="text-slate-500">
                        {b.sentRows} / {b.totalRows} Sent • {b.failedRows} Failed
                      </div>
                    </div>
                    <Link
                      href={`/dashboard/bulk-send/${b.id}`}
                      className="text-blue-600 hover:underline font-semibold"
                    >
                      View Batch Details →
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "public_forms" && (
        <div className="space-y-6">
          {/* Conversion Funnel */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="font-bold text-slate-900 text-base">Public Form Conversion Funnel</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-xs text-slate-500 font-semibold block uppercase">1. Started / Opened</span>
                <span className="text-2xl font-extrabold text-slate-900">{publicForms?.startedCount ?? 0}</span>
              </div>
              <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
                <span className="text-xs text-blue-700 font-semibold block uppercase">2. Total Submissions</span>
                <span className="text-2xl font-extrabold text-blue-900">{publicForms?.totalSubmissions ?? 0}</span>
              </div>
              <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200">
                <span className="text-xs text-emerald-700 font-semibold block uppercase">3. Fully Completed</span>
                <span className="text-2xl font-extrabold text-emerald-900">{publicForms?.completedCount ?? 0}</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-200">
              <h3 className="font-bold text-slate-900 text-base">Active Public Forms Performance</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-500 uppercase">
                  <tr>
                    <th className="px-6 py-3">Form Name</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3">Submissions</th>
                    <th className="px-6 py-3">Completed</th>
                    <th className="px-6 py-3">Conversion Rate</th>
                    <th className="px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {publicForms?.forms.map((f) => (
                    <tr key={f.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-6 py-4 font-semibold text-slate-900">{f.name}</td>
                      <td className="px-6 py-4">
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                          {f.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">{f.submissionsCount}</td>
                      <td className="px-6 py-4">{f.completedCount}</td>
                      <td className="px-6 py-4 font-medium text-emerald-700">
                        {f.conversionRate !== null ? `${f.conversionRate}%` : "—"}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link
                          href={`/dashboard/public-forms/${f.id}/submissions`}
                          className="text-blue-600 hover:underline font-semibold"
                        >
                          View Log →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Export Report Modal */}
      <Dialog open={showExportModal} onOpenChange={setShowExportModal}>
        <DialogContent className="sm:max-w-md bg-white text-slate-900 border-slate-200">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900">
              Export Analytics Report (CSV)
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Select Export Section</Label>
              <select
                value={exportSection}
                onChange={(e) => setExportSection(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-md text-slate-900 text-xs"
              >
                <option value="summary">Top-level Overview Summary</option>
                <option value="documents">Detailed Document Log</option>
                <option value="templates">Template Usage Statistics</option>
                <option value="contacts">Contact Analytics</option>
                <option value="bulk_send">Bulk Send Performance</option>
                <option value="public_forms">Public Form Funnel</option>
              </select>
            </div>
            <p className="text-slate-500">
              Exports data for range: <span className="font-semibold text-slate-800">{preset}</span>. Internal tokens and secrets are never exported.
            </p>
          </div>

          <DialogFooter className="pt-3">
            <Button
              variant="outline"
              onClick={() => setShowExportModal(false)}
              className="border-slate-300 text-slate-700 hover:bg-slate-50 text-xs"
            >
              Cancel
            </Button>
            <Button
              onClick={handleExportCSV}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs"
            >
              Download CSV
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Custom Date Range Modal */}
      <Dialog open={showCustomModal} onOpenChange={setShowCustomModal}>
        <DialogContent className="sm:max-w-md bg-white text-slate-900 border-slate-200">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900">
              Set Custom Date Range
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleApplyCustomRange} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Start Date</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
                className="bg-white text-slate-900 border-slate-300 text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">End Date</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required
                className="bg-white text-slate-900 border-slate-300 text-xs"
              />
            </div>

            <DialogFooter className="pt-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowCustomModal(false)}
                className="border-slate-300 text-slate-700 hover:bg-slate-50 text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs"
              >
                Apply Range
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatusDistributionBar({
  label,
  count,
  total,
  colorBg,
  colorText,
}: {
  label: string;
  count: number;
  total: number;
  colorBg: string;
  colorText: string;
}) {
  const percent = total > 0 ? Math.round((count / total) * 100) : 0;

  return (
    <div className="space-y-1 text-xs">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-slate-700">{label}</span>
        <span className={`font-bold ${colorText}`}>
          {count} ({percent}%)
        </span>
      </div>
      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
        <div
          style={{ width: `${percent}%` }}
          className={`h-full ${colorBg} rounded-full transition-all duration-300`}
        />
      </div>
    </div>
  );
}
