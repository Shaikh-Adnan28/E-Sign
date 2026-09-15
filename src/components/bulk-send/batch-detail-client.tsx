"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ChevronLeft,
  RefreshCw,
  Loader2,
  Search,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatRelativeDate, cn } from "@/lib/utils";

export interface BatchDetailItem {
  id: string;
  name: string;
  templateId: string | null;
  templateName: string;
  status: string;
  totalRows: number;
  pendingRows: number;
  processingRows: number;
  sentRows: number;
  failedRows: number;
  csvFilename: string | null;
  createdAt: Date | string | null;
  startedAt: Date | string | null;
  completedAt: Date | string | null;
}

export interface BatchRowItem {
  id: string;
  rowNumber: number;
  sourceData: Record<string, string> | null;
  mappedData: Record<string, { email: string; name?: string }> | null;
  status: string;
  envelopeId: string | null;
  attempts: number;
  errorMessage: string | null;
  processedAt: Date | string | null;
  createdAt: Date | string | null;
}

export function BatchDetailClient({
  batch,
  rows: initialRows,
}: {
  batch: BatchDetailItem;
  rows: BatchRowItem[];
}) {
  const router = useRouter();
  const [rows] = useState<BatchRowItem[]>(initialRows);
  const [statusFilter, setStatusFilter] = useState<"ALL" | "SENT" | "FAILED" | "PENDING">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryingRowId, setRetryingRowId] = useState<string | null>(null);

  const handleRetryAllFailed = async () => {
    setIsRetrying(true);
    try {
      const res = await fetch(`/api/bulk-send/${batch.id}/retry`, { method: "POST" });
      if (res.ok) router.refresh();
    } finally {
      setIsRetrying(false);
    }
  };

  const handleRetrySingleRow = async (rowId: string) => {
    setRetryingRowId(rowId);
    try {
      const res = await fetch(`/api/bulk-send/${batch.id}/retry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rowIds: [rowId] }),
      });
      if (res.ok) router.refresh();
    } finally {
      setRetryingRowId(null);
    }
  };

  const filteredRows = rows.filter((r) => {
    const matchesFilter =
      statusFilter === "ALL" ||
      (statusFilter === "SENT" && r.status === "SENT") ||
      (statusFilter === "FAILED" && r.status === "FAILED") ||
      (statusFilter === "PENDING" && (r.status === "PENDING" || r.status === "PROCESSING"));

    const recipientString = JSON.stringify(r.mappedData || {}).toLowerCase();
    const matchesSearch = !searchQuery || recipientString.includes(searchQuery.toLowerCase());

    return matchesFilter && matchesSearch;
  });

  const percentComplete = batch.totalRows > 0 ? Math.round((batch.sentRows / batch.totalRows) * 100) : 0;
  const isCompleted = batch.status === "COMPLETED";
  const isPartial = batch.status === "COMPLETED_WITH_ERRORS";
  const isFailed = batch.status === "FAILED";

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Link
        href="/dashboard/bulk-send"
        className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-[#1A56DB] transition-colors"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
        Back to Bulk Send Batches
      </Link>

      {/* Header Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900 leading-snug">{batch.name}</h1>
              <span
                className={cn(
                  "font-bold text-xs px-2.5 py-0.5 rounded-full shrink-0",
                  isCompleted
                    ? "bg-emerald-100 text-emerald-800"
                    : isPartial
                    ? "bg-amber-100 text-amber-800"
                    : isFailed
                    ? "bg-red-100 text-red-800"
                    : "bg-blue-100 text-blue-800"
                )}
              >
                {batch.status}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              Template: <strong className="text-slate-800">{batch.templateName}</strong> &bull; CSV:{" "}
              <span className="font-mono text-slate-700">{batch.csvFilename || "recipients.csv"}</span> &bull; Created{" "}
              {batch.createdAt ? formatRelativeDate(new Date(batch.createdAt)) : ""}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {batch.failedRows > 0 && (
              <Button
                onClick={handleRetryAllFailed}
                disabled={isRetrying}
                className="bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs gap-1.5 shadow-xs"
              >
                {isRetrying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                Retry Failed Rows ({batch.failedRows})
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => router.refresh()}
              className="text-xs font-semibold text-slate-700 border-slate-300"
            >
              <RefreshCw className="h-3.5 w-3.5 mr-1.5 text-slate-500" /> Refresh
            </Button>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-1.5 pt-2">
          <div className="flex justify-between text-xs font-medium text-slate-600">
            <span>Overall Completion Progress</span>
            <span className="font-bold text-[#1A56DB]">{percentComplete}%</span>
          </div>
          <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500",
                isPartial ? "bg-amber-500" : isFailed ? "bg-red-500" : "bg-emerald-500"
              )}
              style={{ width: `${percentComplete}%` }}
            />
          </div>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs">
          <p className="text-slate-500 font-semibold">Total Recipients</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{batch.totalRows}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-emerald-200/80 shadow-2xs">
          <p className="text-emerald-700 font-semibold">Successfully Sent</p>
          <p className="text-2xl font-bold text-emerald-800 mt-1">{batch.sentRows}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-blue-200/80 shadow-2xs">
          <p className="text-blue-700 font-semibold">Pending / In Progress</p>
          <p className="text-2xl font-bold text-blue-800 mt-1">{batch.pendingRows}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-red-200/80 shadow-2xs">
          <p className="text-red-700 font-semibold">Failed Rows</p>
          <p className="text-2xl font-bold text-red-800 mt-1">{batch.failedRows}</p>
        </div>
      </div>

      {/* Recipients Table Panel */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden space-y-0">
        {/* Table Filter Controls */}
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5">
            {(["ALL", "SENT", "FAILED", "PENDING"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setStatusFilter(tab)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-bold transition-colors",
                  statusFilter === tab
                    ? "bg-[#1A56DB] text-white"
                    : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                )}
              >
                {tab === "ALL" ? `All (${rows.length})` : tab === "SENT" ? `Sent (${batch.sentRows})` : tab === "FAILED" ? `Failed (${batch.failedRows})` : `Pending (${batch.pendingRows})`}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <Input
              placeholder="Filter by recipient..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8 text-xs bg-white"
            />
          </div>
        </div>

        {/* Rows Table */}
        <div className="divide-y divide-slate-100 text-xs">
          {filteredRows.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              No recipient rows match the selected filter.
            </div>
          ) : (
            filteredRows.map((r) => {
              const recipientValues = Object.values(r.mappedData || {});
              const primaryRecipient = recipientValues[0];

              return (
                <div key={r.id} className="p-4 hover:bg-slate-50 flex items-center justify-between gap-4 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="font-mono text-xs font-bold px-2 py-1 rounded bg-slate-100 text-slate-700 shrink-0">
                      Row #{r.rowNumber}
                    </span>

                    <div className="min-w-0">
                      <p className="font-bold text-slate-900 truncate">
                        {primaryRecipient?.name || primaryRecipient?.email || "Recipient"}
                      </p>
                      <p className="text-[11px] text-slate-500 font-medium truncate">
                        {primaryRecipient?.email}
                        {recipientValues.length > 1 && ` (+${recipientValues.length - 1} other roles)`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    {r.errorMessage && (
                      <span className="text-[11px] font-medium text-red-600 bg-red-50 px-2.5 py-1 rounded border border-red-200 max-w-xs truncate">
                        {r.errorMessage}
                      </span>
                    )}

                    <span
                      className={cn(
                        "font-semibold text-[10px] px-2.5 py-0.5 rounded-full shrink-0",
                        r.status === "SENT"
                          ? "bg-emerald-100 text-emerald-800"
                          : r.status === "FAILED"
                          ? "bg-red-100 text-red-800"
                          : "bg-blue-100 text-blue-800"
                      )}
                    >
                      {r.status}
                    </span>

                    {r.status === "FAILED" && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={retryingRowId === r.id}
                        onClick={() => handleRetrySingleRow(r.id)}
                        className="h-7 text-xs font-semibold text-amber-700 border-amber-200 hover:bg-amber-50"
                      >
                        {retryingRowId === r.id ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <RefreshCw className="h-3 w-3 mr-1" />}
                        Retry
                      </Button>
                    )}

                    {r.envelopeId && (
                      <Button asChild variant="outline" size="sm" className="h-7 text-xs font-semibold text-slate-700">
                        <Link href={`/dashboard/documents/${r.envelopeId}`}>
                          <ExternalLink className="h-3 w-3 mr-1" /> Envelope
                        </Link>
                      </Button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
