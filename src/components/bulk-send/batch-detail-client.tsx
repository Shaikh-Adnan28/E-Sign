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
  AlertTriangle,
  CheckCircle2,
  MoreVertical,
  Edit3,
  Eye,
  User,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatRelativeDate, isValidEmail, cn } from "@/lib/utils";

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

export interface TemplateRoleItem {
  id: string;
  roleName: string;
  order: number;
}

export function BatchDetailClient({
  batch,
  rows: initialRows,
  templateRoles = [],
}: {
  batch: BatchDetailItem;
  rows: BatchRowItem[];
  templateRoles?: TemplateRoleItem[];
}) {
  const router = useRouter();
  const [rows] = useState<BatchRowItem[]>(initialRows);
  const [statusFilter, setStatusFilter] = useState<"ALL" | "SENT" | "FAILED" | "PENDING">("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [isRetryingAll, setIsRetryingAll] = useState(false);
  const [retryingRowId, setRetryingRowId] = useState<string | null>(null);

  // Modal State for Error Details & Recipient Editing
  const [selectedRow, setSelectedRow] = useState<BatchRowItem | null>(null);
  const [editedData, setEditedData] = useState<Record<string, { email: string; name?: string }>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSavingRow, setIsSavingRow] = useState(false);
  const [modalActionError, setModalActionError] = useState("");

  const handleOpenRowModal = (row: BatchRowItem) => {
    setSelectedRow(row);
    setModalActionError("");
    setFieldErrors({});

    // Populate editedData from mappedData
    const initialMapped = row.mappedData || {};
    const initialEdit: Record<string, { email: string; name?: string }> = {};

    // If templateRoles provided, ensure entry for every role
    if (templateRoles.length > 0) {
      templateRoles.forEach((role) => {
        initialEdit[role.id] = {
          email: initialMapped[role.id]?.email || "",
          name: initialMapped[role.id]?.name || "",
        };
      });
    } else {
      // Fallback if no roles defined on template
      Object.keys(initialMapped).forEach((roleId) => {
        initialEdit[roleId] = {
          email: initialMapped[roleId]?.email || "",
          name: initialMapped[roleId]?.name || "",
        };
      });
    }

    setEditedData(initialEdit);
  };

  const handleCloseRowModal = () => {
    setSelectedRow(null);
    setEditedData({});
    setFieldErrors({});
    setModalActionError("");
  };

  const validateEditedFields = (): boolean => {
    const errors: Record<string, string> = {};
    let valid = true;

    Object.entries(editedData).forEach(([roleId, val]) => {
      const trimmedEmail = (val.email || "").trim();
      if (!trimmedEmail) {
        errors[`${roleId}_email`] = "Email address is required.";
        valid = false;
      } else if (!isValidEmail(trimmedEmail)) {
        errors[`${roleId}_email`] = "Enter a valid email address.";
        valid = false;
      }
    });

    setFieldErrors(errors);
    return valid;
  };

  const handleSaveRow = async (retryNow: boolean) => {
    if (!selectedRow) return;
    if (!validateEditedFields()) return;

    setIsSavingRow(true);
    setModalActionError("");

    try {
      const res = await fetch(`/api/bulk-send/${batch.id}/row/${selectedRow.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientData: editedData,
          retryNow,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update recipient details.");
      }

      handleCloseRowModal();
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "An error occurred while saving.";
      setModalActionError(msg);
    } finally {
      setIsSavingRow(false);
    }
  };

  const handleRetryAllFailed = async () => {
    setIsRetryingAll(true);
    try {
      const res = await fetch(`/api/bulk-send/${batch.id}/retry`, { method: "POST" });
      if (res.ok) router.refresh();
    } finally {
      setIsRetryingAll(false);
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
  const isPartial = batch.status === "COMPLETED_WITH_ERRORS";
  const isFailed = batch.status === "FAILED";

  const getStatusInfo = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return { label: "Completed", class: "bg-emerald-50 text-emerald-700 border-emerald-200" };
      case "COMPLETED_WITH_ERRORS":
        return { label: "Partial Success", class: "bg-amber-50 text-amber-700 border-amber-200" };
      case "FAILED":
        return { label: "Failed", class: "bg-red-50 text-red-700 border-red-200" };
      case "PROCESSING":
        return { label: "Processing", class: "bg-blue-50 text-blue-700 border-blue-200 animate-pulse" };
      default:
        return { label: "Ready", class: "bg-slate-100 text-slate-700 border-slate-200" };
    }
  };

  const batchStatusInfo = getStatusInfo(batch.status);

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href="/dashboard/bulk-send"
        className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-[#1A56DB] transition-colors"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to Bulk Send Batches
      </Link>

      {/* Header Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                <Layers className="h-5 w-5 text-[#1A56DB]" />
                {batch.name}
              </h1>
              <span
                className={cn(
                  "font-bold text-[11px] px-2.5 py-0.5 rounded-full border uppercase tracking-wider shrink-0",
                  batchStatusInfo.class
                )}
              >
                {batchStatusInfo.label}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              Template: <strong className="text-slate-800">{batch.templateName}</strong> &bull; CSV:{" "}
              <span className="font-mono text-slate-700">{batch.csvFilename || "recipients.csv"}</span> &bull; Created{" "}
              {batch.createdAt ? formatRelativeDate(new Date(batch.createdAt)) : "recently"}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {batch.failedRows > 0 && (
              <Button
                onClick={handleRetryAllFailed}
                disabled={isRetryingAll}
                className="bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs gap-1.5 shadow-xs"
              >
                {isRetryingAll ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                Retry All Failed ({batch.failedRows})
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
          <div className="flex justify-between text-xs font-bold text-slate-700">
            <span>Overall Completion Progress</span>
            <span className="text-[#1A56DB]">{percentComplete}%</span>
          </div>
          <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500",
                isPartial ? "bg-amber-500" : isFailed ? "bg-red-500" : "bg-[#1A56DB]"
              )}
              style={{ width: `${percentComplete}%` }}
            />
          </div>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs">
          <p className="text-slate-500 font-bold">Total Recipients</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{batch.totalRows}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-emerald-200/80 shadow-2xs">
          <p className="text-emerald-700 font-bold">Successfully Sent</p>
          <p className="text-2xl font-bold text-emerald-800 mt-1">{batch.sentRows}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-blue-200/80 shadow-2xs">
          <p className="text-blue-700 font-bold">Pending / In Progress</p>
          <p className="text-2xl font-bold text-blue-800 mt-1">{batch.pendingRows}</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-red-200/80 shadow-2xs">
          <p className="text-red-700 font-bold">Failed Rows</p>
          <p className="text-2xl font-bold text-red-800 mt-1">{batch.failedRows}</p>
        </div>
      </div>

      {/* Success / Partial Attention Banner */}
      {batch.failedRows === 0 && batch.totalRows > 0 && batch.sentRows === batch.totalRows ? (
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 font-bold flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
          <span>All recipients were sent successfully. ({batch.sentRows} of {batch.totalRows} recipients sent)</span>
        </div>
      ) : batch.failedRows > 0 ? (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 font-bold flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
            <span>
              {batch.sentRows} of {batch.totalRows} recipients sent.{" "}
              <strong className="text-amber-800">{batch.failedRows} recipient{batch.failedRows > 1 ? "s" : ""} need attention.</strong>
            </span>
          </div>
          <span className="text-[11px] text-amber-700 font-semibold hidden sm:inline">
            Click any failed row to correct recipient details and retry.
          </span>
        </div>
      ) : null}

      {/* Recipients Results Table Panel */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
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
                    : "bg-white text-slate-700 border border-slate-200 hover:bg-slate-50"
                )}
              >
                {tab === "ALL" ? `All (${rows.length})` : tab === "SENT" ? `Sent (${batch.sentRows})` : tab === "FAILED" ? `Failed (${batch.failedRows})` : `Pending (${batch.pendingRows})`}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <Input
              placeholder="Search recipient or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8 text-xs bg-white text-slate-900 border-slate-300 placeholder:text-slate-400 font-medium"
            />
          </div>
        </div>

        {/* Rows Table */}
        <div className="divide-y divide-slate-100 text-xs">
          {filteredRows.length === 0 ? (
            <div className="p-12 text-center text-slate-400 font-medium">
              No recipient rows match the selected filter.
            </div>
          ) : (
            filteredRows.map((r) => {
              const recipientValues = Object.values(r.mappedData || {});
              const primaryRecipient = recipientValues[0];
              const rowStatusInfo = getStatusInfo(r.status);

              return (
                <div
                  key={r.id}
                  onClick={() => handleOpenRowModal(r)}
                  className="p-4 hover:bg-slate-50 flex items-center justify-between gap-4 transition-colors cursor-pointer group"
                >
                  {/* Row # & Recipient Info */}
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span className="font-mono text-xs font-bold px-2 py-1 rounded bg-slate-100 text-slate-800 border border-slate-200 shrink-0">
                      Row #{r.rowNumber}
                    </span>

                    <div className="min-w-0">
                      <p className="font-bold text-slate-900 group-hover:text-[#1A56DB] transition-colors truncate">
                        {primaryRecipient?.name || primaryRecipient?.email || "Recipient"}
                      </p>
                      <p className="text-[11px] text-slate-500 font-medium truncate">
                        {primaryRecipient?.email}
                        {recipientValues.length > 1 && ` (+${recipientValues.length - 1} other signer roles)`}
                      </p>
                    </div>
                  </div>

                  {/* Status & Short Error Summary */}
                  <div className="flex items-center gap-3 shrink-0">
                    {r.errorMessage && (
                      <span className="text-[11px] font-semibold text-red-700 bg-red-50 px-2.5 py-1 rounded border border-red-200 max-w-xs truncate flex items-center gap-1 hover:bg-red-100">
                        <AlertTriangle className="h-3 w-3 text-red-600 shrink-0" />
                        <span className="truncate">{r.errorMessage}</span>
                        <span className="text-[10px] text-red-600 underline ml-1 hidden md:inline">View error &rarr;</span>
                      </span>
                    )}

                    <span
                      className={cn(
                        "font-bold text-[10px] px-2.5 py-0.5 rounded-full border uppercase tracking-wider shrink-0",
                        rowStatusInfo.class
                      )}
                    >
                      {rowStatusInfo.label}
                    </span>

                    {/* Actions Menu */}
                    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
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
                        <Button asChild variant="outline" size="sm" className="h-7 text-xs font-semibold text-slate-700 border-slate-300">
                          <Link href={`/dashboard/documents/${r.envelopeId}`}>
                            <ExternalLink className="h-3 w-3 mr-1" /> Envelope
                          </Link>
                        </Button>
                      )}

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-slate-500 hover:text-slate-800">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44 text-xs font-medium">
                          <DropdownMenuItem onClick={() => handleOpenRowModal(r)} className="cursor-pointer">
                            <Eye className="h-3.5 w-3.5 mr-2 text-slate-500" />
                            <span>View details</span>
                          </DropdownMenuItem>
                          {r.status === "FAILED" && (
                            <>
                              <DropdownMenuItem onClick={() => handleOpenRowModal(r)} className="cursor-pointer font-bold text-[#1A56DB]">
                                <Edit3 className="h-3.5 w-3.5 mr-2 text-[#1A56DB]" />
                                <span>Edit recipient</span>
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleRetrySingleRow(r.id)} className="cursor-pointer text-amber-700">
                                <RefreshCw className="h-3.5 w-3.5 mr-2 text-amber-600" />
                                <span>Retry now</span>
                              </DropdownMenuItem>
                            </>
                          )}
                          {r.envelopeId && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem asChild className="cursor-pointer">
                                <Link href={`/dashboard/documents/${r.envelopeId}`}>
                                  <ExternalLink className="h-3.5 w-3.5 mr-2 text-slate-500" />
                                  <span>View envelope</span>
                                </Link>
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Row Detail & Recipient Edit Modal */}
      <Dialog open={!!selectedRow} onOpenChange={(open) => !open && handleCloseRowModal()}>
        <DialogContent className="sm:max-w-2xl w-[94vw] bg-white rounded-2xl p-6 border border-slate-200 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto min-w-0">
          {selectedRow && (
            <>
              <DialogHeader className="flex flex-row items-center justify-between pb-2 border-b border-slate-100">
                <div className="space-y-1 min-w-0">
                  <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2 flex-wrap">
                    <span>Bulk Send Row #{selectedRow.rowNumber}</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 font-semibold shrink-0">
                      Immutable Ref
                    </span>
                  </DialogTitle>
                  <p className="text-xs text-slate-500 font-medium truncate">
                    Review error details and update recipient signer information.
                  </p>
                </div>
              </DialogHeader>

              {/* Status & Error Display Card */}
              {selectedRow.status === "FAILED" && selectedRow.errorMessage && (
                <div className="bg-red-50 border border-red-200/90 rounded-xl p-4 space-y-2 text-xs overflow-hidden">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-red-800 flex items-center gap-1.5">
                      <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" /> Status: FAILED
                    </span>
                    <span className="text-[10px] font-semibold text-red-600">Attempt #{selectedRow.attempts}</span>
                  </div>
                  <div>
                    <p className="font-bold text-red-700">Error Summary:</p>
                    <p className="text-red-900 font-medium mt-0.5 break-words whitespace-pre-wrap">{selectedRow.errorMessage}</p>
                  </div>
                  <div className="pt-1 text-[11px] text-red-600 font-medium">
                    Correct the recipient email address below and click <strong>Save & Retry</strong> to resend without creating duplicate envelopes.
                  </div>
                </div>
              )}

              {/* Recipient Form Fields */}
              <div className="space-y-4 pt-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5 text-[#1A56DB]" /> Recipient Signer Information
                  </h4>
                  <span className="text-[11px] text-slate-500 font-medium">
                    {Object.keys(editedData).length} Role(s) Defined
                  </span>
                </div>

                <div className="space-y-3 max-h-64 overflow-y-auto pr-1 min-w-0">
                  {Object.keys(editedData).map((roleId, idx) => {
                    const roleMeta = templateRoles.find((r) => r.id === roleId);
                    const roleTitle = roleMeta ? roleMeta.roleName : `Signer Role #${idx + 1}`;
                    const val = editedData[roleId] || { email: "", name: "" };
                    const emailErr = fieldErrors[`${roleId}_email`];

                    return (
                      <div key={roleId} className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-3.5 space-y-3 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-100 text-blue-800 rounded">
                            Order {roleMeta?.order ?? idx + 1}
                          </span>
                          <span className="text-xs font-bold text-slate-800 truncate">{roleTitle}</span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs w-full min-w-0">
                          <div className="min-w-0">
                            <Label className="text-xs font-bold text-slate-700 block mb-1">Full Name</Label>
                            <Input
                              value={val.name || ""}
                              onChange={(e) =>
                                setEditedData((prev) => ({
                                  ...prev,
                                  [roleId]: { ...prev[roleId], name: e.target.value },
                                }))
                              }
                              placeholder="Full Name (Optional)"
                              className="h-9 text-xs bg-white text-slate-900 border-slate-300 font-bold placeholder:text-slate-400 focus:border-[#1A56DB] w-full min-w-0"
                            />
                          </div>

                          <div className="min-w-0">
                            <Label className="text-xs font-bold text-slate-700 block mb-1">Email Address *</Label>
                            <Input
                              type="email"
                              value={val.email || ""}
                              onChange={(e) =>
                                setEditedData((prev) => ({
                                  ...prev,
                                  [roleId]: { ...prev[roleId], email: e.target.value },
                                }))
                              }
                              placeholder="signer@example.com"
                              className={cn(
                                "h-9 text-xs bg-white text-slate-900 border-slate-300 font-bold placeholder:text-slate-400 focus:border-[#1A56DB] w-full min-w-0",
                                emailErr && "border-red-500 focus:border-red-500"
                              )}
                            />
                            {emailErr && (
                              <p className="text-[11px] font-semibold text-red-700 mt-1">{emailErr}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {modalActionError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-semibold text-red-700">
                  {modalActionError}
                </div>
              )}

              {/* Modal Footer Actions */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <Button variant="outline" size="sm" onClick={handleCloseRowModal} className="text-xs font-semibold text-slate-700">
                  Cancel
                </Button>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isSavingRow}
                    onClick={() => handleSaveRow(false)}
                    className="text-xs font-semibold text-slate-800 border-slate-300 hover:bg-slate-50"
                  >
                    Save Changes
                  </Button>

                  <Button
                    size="sm"
                    disabled={isSavingRow}
                    onClick={() => handleSaveRow(true)}
                    className="bg-[#1A56DB] hover:bg-blue-700 text-white font-semibold text-xs gap-1.5 shadow-xs"
                  >
                    {isSavingRow ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                    Save & Retry
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
