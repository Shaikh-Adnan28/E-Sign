"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Layers,
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Check,
  Download,
  Bell,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MAX_BULK_ROWS, parseCsvContent, validateBulkBatch, RoleMappingConfig, BulkValidationResult } from "@/lib/utils/csv-parser";
import { formatDate, formatRelativeDate, cn } from "@/lib/utils";

export interface TemplateItem {
  id: string;
  name: string;
  description: string | null;
  filename: string;
  pageCount: number | null;
  usageCount: number;
  roles: Array<{ id: string; roleName: string; order: number }>;
}

export interface BatchItem {
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
}

export function BulkSendClient({
  initialTemplates,
  initialBatches,
}: {
  initialTemplates: TemplateItem[];
  initialBatches: BatchItem[];
}) {
  const router = useRouter();
  const batches = initialBatches;
  const [showWizard, setShowWizard] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5 | 6>(1);

  // Wizard state
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateItem | null>(null);
  const [searchTemplate, setSearchTemplate] = useState("");
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvText, setCsvText] = useState("");
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<Record<string, string>[]>([]);

  // Mapping state
  const [roleMapping, setRoleMapping] = useState<RoleMappingConfig>({});

  // Validation state
  const [validationResult, setValidationResult] = useState<BulkValidationResult | null>(null);

  // Settings & Send state
  const [batchName, setBatchName] = useState("");
  const [reminderEnabled, setReminderEnabled] = useState(true);
  const [reminderFirstAfterDays, setReminderFirstAfterDays] = useState(2);
  const [reminderEveryDays, setReminderEveryDays] = useState(3);
  const [reminderMessage, setReminderMessage] = useState("");
  const [expirationDays, setExpirationDays] = useState(7);
  const [expirationWarningDays, setExpirationWarningDays] = useState(3);

  // Processing state
  const [isCreatingBatch, setIsCreatingBatch] = useState(false);
  const [sendError, setSendError] = useState("");
  const [createdBatchId, setCreatedBatchId] = useState<string | null>(null);
  const [retryingBatchId, setRetryingBatchId] = useState<string | null>(null);

  // Download CSV template generator
  const handleDownloadSampleCsv = () => {
    if (!selectedTemplate) return;
    const columns: string[] = [];
    selectedTemplate.roles.forEach((r) => {
      const sanitized = r.roleName.toLowerCase().replace(/[^a-z0-9]/g, "_");
      columns.push(`${sanitized}_email`, `${sanitized}_name`);
    });

    const csvContent = `${columns.join(",")}\n` +
      selectedTemplate.roles.map((r) => `${r.roleName.toLowerCase().replace(/[^a-z0-9]/g, "_")}@example.com,Sample ${r.roleName}`).join(",");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `${selectedTemplate.name.toLowerCase().replace(/[^a-z0-9]/g, "_")}_sample.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // CSV File Upload handler
  const handleFileUpload = (file: File) => {
    setCsvFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setCsvText(text);
      const parsed = parseCsvContent(text);
      setCsvHeaders(parsed.headers);
      setCsvRows(parsed.rows);

      // Auto-populate default column mappings if header names match role names
      if (selectedTemplate) {
        const autoMap: RoleMappingConfig = {};
        selectedTemplate.roles.forEach((role) => {
          const roleClean = role.roleName.toLowerCase().replace(/[^a-z0-9]/g, "");
          const matchedEmailHeader = parsed.headers.find(
            (h) => h.toLowerCase().includes(roleClean) && h.toLowerCase().includes("email")
          ) || parsed.headers.find((h) => h.toLowerCase() === "email" || h.toLowerCase() === "email address");

          const matchedNameHeader = parsed.headers.find(
            (h) => h.toLowerCase().includes(roleClean) && h.toLowerCase().includes("name")
          ) || parsed.headers.find((h) => h.toLowerCase() === "name" || h.toLowerCase() === "full name");

          autoMap[role.id] = {
            emailColumn: matchedEmailHeader || parsed.headers[0] || "",
            nameColumn: matchedNameHeader || "",
          };
        });
        setRoleMapping(autoMap);
      }
    };
    reader.readAsText(file);
  };

  const handleRunValidation = () => {
    if (!selectedTemplate) return;
    const res = validateBulkBatch(selectedTemplate.roles, csvRows, roleMapping);
    setValidationResult(res);
  };

  const handleStartSendBatch = async () => {
    if (!selectedTemplate || !csvFile) return;
    setIsCreatingBatch(true);
    setSendError("");
    try {
      const name = batchName.trim() || `${selectedTemplate.name} Bulk Request - ${formatDate(new Date())}`;

      // 1. Create Batch API call
      const res = await fetch("/api/bulk-send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: selectedTemplate.id,
          name,
          csvFilename: csvFile.name,
          csvContent: csvText,
          roleMapping,
          reminderConfig: {
            reminderEnabled,
            reminderFirstAfterDays: Number(reminderFirstAfterDays),
            reminderEveryDays: Number(reminderEveryDays),
            reminderMessage: reminderMessage.trim() || null,
            expirationDays: Number(expirationDays),
            expirationWarningDays: Number(expirationWarningDays),
          },
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setSendError(data.error || "Failed to create bulk send batch");
        setIsCreatingBatch(false);
        return;
      }

      const { batch } = await res.json();
      setCreatedBatchId(batch.id);
      setStep(6);

      // 2. Trigger Batch processing execution
      fetch(`/api/bulk-send/${batch.id}/start`, { method: "POST" }).catch((err) =>
        console.error("Background batch processing trigger failed:", err)
      );

      // Refresh list
      router.refresh();
    } catch {
      setSendError("An unexpected error occurred while initiating bulk send.");
    } finally {
      setIsCreatingBatch(false);
    }
  };

  const handleRetryFailedBatch = async (batchId: string) => {
    setRetryingBatchId(batchId);
    try {
      const res = await fetch(`/api/bulk-send/${batchId}/retry`, { method: "POST" });
      if (res.ok) {
        router.refresh();
      }
    } finally {
      setRetryingBatchId(null);
    }
  };

  const filteredTemplates = initialTemplates.filter((t) =>
    t.name.toLowerCase().includes(searchTemplate.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200/80">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Layers className="h-6 w-6 text-[#1A56DB]" /> Bulk Send
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Send mass signature requests efficiently using existing document templates and recipient CSV files.
          </p>
        </div>
        <Button
          onClick={() => {
            setShowWizard(true);
            setStep(1);
          }}
          className="bg-[#1A56DB] hover:bg-blue-700 text-white font-semibold gap-1.5 shadow-sm"
        >
          <Plus className="h-4 w-4" /> New Bulk Send
        </Button>
      </div>

      {/* Main Wizard or Batches View */}
      {showWizard ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-md p-6 space-y-6">
          {/* Wizard Stepper Header */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              {[
                { num: 1, label: "Template" },
                { num: 2, label: "CSV File" },
                { num: 3, label: "Mapping" },
                { num: 4, label: "Validate" },
                { num: 5, label: "Review & Send" },
              ].map((s, idx) => (
                <div key={s.num} className="flex items-center gap-2">
                  <div
                    className={cn(
                      "h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors",
                      step === s.num
                        ? "bg-[#1A56DB] text-white"
                        : step > s.num
                        ? "bg-emerald-500 text-white"
                        : "bg-slate-100 text-slate-400"
                    )}
                  >
                    {step > s.num ? <Check className="h-4 w-4" /> : s.num}
                  </div>
                  <span
                    className={cn(
                      "text-xs font-semibold hidden md:inline",
                      step === s.num ? "text-slate-900" : "text-slate-400"
                    )}
                  >
                    {s.label}
                  </span>
                  {idx < 4 && <div className="w-4 h-0.5 bg-slate-200 hidden md:block" />}
                </div>
              ))}
            </div>

            <button
              onClick={() => setShowWizard(false)}
              className="text-xs font-semibold text-slate-500 hover:text-slate-800"
            >
              Cancel & Exit
            </button>
          </div>

          {/* STEP 1: CHOOSE TEMPLATE */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Step 1: Choose Template</h2>
                  <p className="text-xs text-slate-500">Select a template to generate mass signature envelopes.</p>
                </div>
                <div className="relative w-64">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <Input
                    placeholder="Search templates..."
                    value={searchTemplate}
                    onChange={(e) => setSearchTemplate(e.target.value)}
                    className="pl-8 h-8 text-xs"
                  />
                </div>
              </div>

              {filteredTemplates.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-2xl space-y-3">
                  <Layers className="h-10 w-10 text-slate-300 mx-auto" />
                  <h3 className="text-sm font-bold text-slate-800">No Templates Found</h3>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    Create a document template with defined signer roles before launching a bulk send request.
                  </p>
                  <Button asChild size="sm" className="bg-[#1A56DB]">
                    <Link href="/dashboard/templates">Create Template</Link>
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredTemplates.map((t) => {
                    const isSelected = selectedTemplate?.id === t.id;
                    return (
                      <div
                        key={t.id}
                        onClick={() => setSelectedTemplate(t)}
                        className={cn(
                          "p-4 rounded-xl border cursor-pointer transition-all space-y-3 relative",
                          isSelected
                            ? "border-[#1A56DB] bg-blue-50/50 ring-2 ring-[#1A56DB]/20"
                            : "border-slate-200 bg-white hover:border-slate-300"
                        )}
                      >
                        <div className="flex items-start justify-between">
                          <h4 className="text-sm font-bold text-slate-900 truncate pr-4">{t.name}</h4>
                          {isSelected && <CheckCircle2 className="h-5 w-5 text-[#1A56DB] shrink-0" />}
                        </div>
                        <p className="text-xs text-slate-500 line-clamp-2 min-h-[32px]">
                          {t.description || "No description provided."}
                        </p>
                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] font-semibold text-slate-600">
                          <span>{t.roles.length} Signer Role{t.roles.length === 1 ? "" : "s"}</span>
                          <span>{t.pageCount || 1} Pages</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="flex justify-end pt-4 border-t border-slate-100">
                <Button
                  disabled={!selectedTemplate}
                  onClick={() => setStep(2)}
                  className="bg-[#1A56DB] hover:bg-blue-700 text-white font-semibold gap-1.5"
                >
                  Next: Upload CSV <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* STEP 2: UPLOAD CSV */}
          {step === 2 && selectedTemplate && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Step 2: Upload Recipient CSV</h2>
                  <p className="text-xs text-slate-500">
                    Upload a CSV file containing recipient names and email addresses for template role mapping.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadSampleCsv}
                  className="gap-1.5 text-xs font-semibold text-slate-700 border-slate-300 hover:bg-slate-50"
                >
                  <Download className="h-3.5 w-3.5" /> Download CSV Template
                </Button>
              </div>

              <div className="border-2 border-dashed border-slate-300 rounded-2xl p-8 text-center space-y-3 bg-slate-50/50 hover:bg-slate-50 transition-colors">
                <FileSpreadsheet className="h-10 w-10 text-[#1A56DB] mx-auto" />
                <div className="space-y-1">
                  <p className="text-xs font-bold text-slate-800">
                    Drag and drop your CSV file here, or click to browse
                  </p>
                  <p className="text-[11px] text-slate-500">Supported format: CSV (Max {MAX_BULK_ROWS} rows per batch)</p>
                </div>

                <input
                  type="file"
                  accept=".csv"
                  id="csv-upload-input"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.[0]) handleFileUpload(e.target.files[0]);
                  }}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => document.getElementById("csv-upload-input")?.click()}
                  className="bg-white border-slate-300 font-semibold"
                >
                  <Upload className="h-3.5 w-3.5 mr-1.5" /> Select CSV File
                </Button>
              </div>

              {csvFile && (
                <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileSpreadsheet className="h-6 w-6 text-[#1A56DB]" />
                    <div>
                      <p className="text-xs font-bold text-slate-900">{csvFile.name}</p>
                      <p className="text-[11px] text-slate-600 font-medium">
                        {(csvFile.size / 1024).toFixed(1)} KB &bull; {csvRows.length} recipient rows detected &bull; {csvHeaders.length} columns
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-red-600 hover:bg-red-50 font-semibold"
                    onClick={() => {
                      setCsvFile(null);
                      setCsvText("");
                      setCsvHeaders([]);
                      setCsvRows([]);
                    }}
                  >
                    Remove
                  </Button>
                </div>
              )}

              <div className="flex justify-between pt-4 border-t border-slate-100">
                <Button variant="outline" size="sm" onClick={() => setStep(1)} className="gap-1.5">
                  <ArrowLeft className="h-4 w-4" /> Back
                </Button>
                <Button
                  disabled={!csvFile || csvRows.length === 0}
                  onClick={() => setStep(3)}
                  className="bg-[#1A56DB] hover:bg-blue-700 text-white font-semibold gap-1.5"
                >
                  Next: Map Columns <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* STEP 3: COLUMN MAPPING */}
          {step === 3 && selectedTemplate && (
            <div className="space-y-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">Step 3: Map CSV Columns to Template Roles</h2>
                <p className="text-xs text-slate-500">
                  Select which CSV columns correspond to each template signer role&apos;s Email and Name.
                </p>
              </div>

              <div className="space-y-3 border border-slate-200/80 rounded-xl p-4 bg-slate-50/50">
                {selectedTemplate.roles.map((role) => {
                  const currentMapping = roleMapping[role.id] || { emailColumn: "", nameColumn: "" };
                  const isEmailMapped = !!currentMapping.emailColumn;

                  return (
                    <div key={role.id} className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold px-2 py-0.5 bg-blue-100 text-blue-800 rounded">
                            Order {role.order}
                          </span>
                          <h4 className="text-sm font-bold text-slate-900">{role.roleName}</h4>
                        </div>
                        <span
                          className={cn(
                            "text-[11px] font-semibold flex items-center gap-1",
                            isEmailMapped ? "text-emerald-600" : "text-amber-600"
                          )}
                        >
                          {isEmailMapped ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
                          {isEmailMapped ? "Email Mapped" : "Email Mapping Required"}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                        <div>
                          <Label className="text-xs font-bold text-slate-800 block mb-1">
                            Recipient Email Column <span className="text-red-500">*</span>
                          </Label>
                          <select
                            value={currentMapping.emailColumn}
                            onChange={(e) =>
                              setRoleMapping((prev) => ({
                                ...prev,
                                [role.id]: { ...prev[role.id], emailColumn: e.target.value },
                              }))
                            }
                            className="w-full h-8 px-2.5 bg-white text-slate-900 font-bold border border-slate-300 rounded-lg text-xs focus:border-[#1A56DB]"
                          >
                            <option value="">-- Select CSV Column --</option>
                            {csvHeaders.map((h) => (
                              <option key={h} value={h}>
                                {h}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <Label className="text-xs font-bold text-slate-800 block mb-1">
                            Recipient Name Column (Optional)
                          </Label>
                          <select
                            value={currentMapping.nameColumn || ""}
                            onChange={(e) =>
                              setRoleMapping((prev) => ({
                                ...prev,
                                [role.id]: { ...prev[role.id], nameColumn: e.target.value },
                              }))
                            }
                            className="w-full h-8 px-2.5 bg-white text-slate-900 font-bold border border-slate-300 rounded-lg text-xs focus:border-[#1A56DB]"
                          >
                            <option value="">-- None (Use email prefix) --</option>
                            {csvHeaders.map((h) => (
                              <option key={h} value={h}>
                                {h}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-between pt-4 border-t border-slate-100">
                <Button variant="outline" size="sm" onClick={() => setStep(2)} className="gap-1.5">
                  <ArrowLeft className="h-4 w-4" /> Back
                </Button>
                <Button
                  onClick={() => {
                    handleRunValidation();
                    setStep(4);
                  }}
                  className="bg-[#1A56DB] hover:bg-blue-700 text-white font-semibold gap-1.5"
                >
                  Next: Validate Data <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* STEP 4: VALIDATION */}
          {step === 4 && validationResult && (
            <div className="space-y-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">Step 4: Batch Validation Results</h2>
                <p className="text-xs text-slate-500">
                  Review data integrity checks before creating signature requests.
                </p>
              </div>

              {/* Summary Metric Cards */}
              <div className="grid grid-cols-4 gap-3 text-xs">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <p className="text-slate-500 font-medium">Total Rows</p>
                  <p className="text-lg font-bold text-slate-900">{validationResult.totalRows}</p>
                </div>
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <p className="text-emerald-700 font-medium">Valid Ready</p>
                  <p className="text-lg font-bold text-emerald-800">{validationResult.validCount}</p>
                </div>
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                  <p className="text-amber-700 font-medium">Warnings</p>
                  <p className="text-lg font-bold text-amber-800">{validationResult.warningCount}</p>
                </div>
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
                  <p className="text-red-700 font-medium">Errors</p>
                  <p className="text-lg font-bold text-red-800">{validationResult.errorCount}</p>
                </div>
              </div>

              {/* Errors & Warnings Details Table */}
              {validationResult.errors.length > 0 && (
                <div className="border border-red-200 rounded-xl overflow-hidden text-xs">
                  <div className="bg-red-50 px-4 py-2 border-b border-red-200 font-bold text-red-800 flex items-center gap-1.5">
                    <XCircle className="h-4 w-4" /> Validation Errors (Must fix CSV before proceeding)
                  </div>
                  <div className="max-h-48 overflow-y-auto divide-y divide-red-100">
                    {validationResult.errors.map((err, idx) => (
                      <div key={idx} className="p-3 flex items-center justify-between hover:bg-red-50/50">
                        <span className="font-semibold text-slate-700">Row {err.rowNumber}</span>
                        <span className="font-mono text-slate-500">{err.field}</span>
                        <span className="text-red-600 font-medium">{err.message}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {validationResult.warnings.length > 0 && (
                <div className="border border-amber-200 rounded-xl overflow-hidden text-xs">
                  <div className="bg-amber-50 px-4 py-2 border-b border-amber-200 font-bold text-amber-800 flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4" /> Warnings (Review duplicate recipients)
                  </div>
                  <div className="max-h-36 overflow-y-auto divide-y divide-amber-100">
                    {validationResult.warnings.map((warn, idx) => (
                      <div key={idx} className="p-3 flex items-center justify-between hover:bg-amber-50/50">
                        <span className="font-semibold text-slate-700">Row {warn.rowNumber}</span>
                        <span className="font-mono text-slate-500">{warn.field}</span>
                        <span className="text-amber-700 font-medium">{warn.message}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {validationResult.isValid && (
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 font-medium flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                  All recipient data passed validation rules. Ready for final review.
                </div>
              )}

              <div className="flex justify-between pt-4 border-t border-slate-100">
                <Button variant="outline" size="sm" onClick={() => setStep(3)} className="gap-1.5">
                  <ArrowLeft className="h-4 w-4" /> Back to Mapping
                </Button>
                <Button
                  disabled={!validationResult.isValid}
                  onClick={() => setStep(5)}
                  className="bg-[#1A56DB] hover:bg-blue-700 text-white font-semibold gap-1.5"
                >
                  Next: Review & Send <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* STEP 5: REVIEW & SEND */}
          {step === 5 && selectedTemplate && (
            <div className="space-y-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">Step 5: Review & Send Configuration</h2>
                <p className="text-xs text-slate-500">
                  Configure batch name, automatic reminders, and expiration deadlines before launching.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Batch Name & Details */}
                <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-200/80 space-y-3 text-xs">
                  <Label className="text-xs font-bold text-slate-800 block">Batch Name</Label>
                  <Input
                    value={batchName}
                    onChange={(e) => setBatchName(e.target.value)}
                    placeholder={`${selectedTemplate.name} Bulk Send - ${formatDate(new Date())}`}
                    className="h-9 text-xs bg-white border-slate-300 font-bold"
                  />

                  <div className="pt-2 border-t border-slate-200 space-y-2">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Template</span>
                      <span className="font-bold text-slate-900">{selectedTemplate.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Recipients</span>
                      <span className="font-bold text-slate-900">{csvRows.length} Envelopes</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Signer Roles</span>
                      <span className="font-bold text-slate-900">{selectedTemplate.roles.length} Roles</span>
                    </div>
                  </div>
                </div>

                {/* Phase 6.0 Reminders & Expiration Integration */}
                <div className="bg-slate-50/80 rounded-xl p-4 border border-slate-200/80 space-y-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 flex items-center gap-1.5">
                      <Bell className="h-3.5 w-3.5 text-[#1A56DB]" /> Automatic Reminders
                    </span>
                    <input
                      type="checkbox"
                      checked={reminderEnabled}
                      onChange={(e) => setReminderEnabled(e.target.checked)}
                      className="h-4 w-4 text-[#1A56DB] rounded border-slate-300"
                    />
                  </div>

                  {reminderEnabled && (
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200">
                      <div>
                        <Label className="text-[10px] text-slate-700 font-bold">First after (Days)</Label>
                        <Input
                          type="number"
                          min={1}
                          max={30}
                          value={reminderFirstAfterDays}
                          onChange={(e) => setReminderFirstAfterDays(Number(e.target.value))}
                          className="h-8 text-xs font-bold bg-white mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-[10px] text-slate-700 font-bold">Repeat every (Days)</Label>
                        <Input
                          type="number"
                          min={1}
                          max={30}
                          value={reminderEveryDays}
                          onChange={(e) => setReminderEveryDays(Number(e.target.value))}
                          className="h-8 text-xs font-bold bg-white mt-1"
                        />
                      </div>
                      <div className="col-span-2 mt-1">
                        <Label className="text-[10px] text-slate-700 font-bold">Reminder Note (Optional)</Label>
                        <Input
                          value={reminderMessage}
                          onChange={(e) => setReminderMessage(e.target.value)}
                          placeholder="Please complete signing at your earliest convenience."
                          className="h-8 text-xs font-medium bg-white mt-1"
                        />
                      </div>
                    </div>
                  )}

                  <div className="pt-2 border-t border-slate-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800">Expires in (Days)</span>
                      <Input
                        type="number"
                        min={1}
                        max={365}
                        value={expirationDays}
                        onChange={(e) => setExpirationDays(Number(e.target.value))}
                        className="w-20 h-8 text-xs text-right font-bold bg-white"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-slate-600">Warn sender before (Days)</span>
                      <Input
                        type="number"
                        min={1}
                        max={30}
                        value={expirationWarningDays}
                        onChange={(e) => setExpirationWarningDays(Number(e.target.value))}
                        className="w-20 h-8 text-xs text-right font-bold bg-white"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {sendError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-600">
                  {sendError}
                </div>
              )}

              <div className="flex justify-between pt-4 border-t border-slate-100">
                <Button variant="outline" size="sm" onClick={() => setStep(4)} className="gap-1.5">
                  <ArrowLeft className="h-4 w-4" /> Back to Validation
                </Button>
                <Button
                  onClick={handleStartSendBatch}
                  disabled={isCreatingBatch}
                  className="bg-[#1A56DB] hover:bg-blue-700 text-white font-semibold gap-2 shadow-sm"
                >
                  {isCreatingBatch ? <Loader2 className="h-4 w-4 animate-spin" /> : <Layers className="h-4 w-4" />}
                  Send {csvRows.length} Signature Requests
                </Button>
              </div>
            </div>
          )}

          {/* STEP 6: PROGRESS / COMPLETE */}
          {step === 6 && (
            <div className="text-center py-12 space-y-4">
              <div className="w-16 h-16 bg-blue-50 text-[#1A56DB] rounded-full flex items-center justify-center mx-auto animate-pulse">
                <Layers size={32} />
              </div>
              <h2 className="text-lg font-bold text-slate-900">Bulk Send Batch Initiated!</h2>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Independent signature requests are being created and sent using the Resend email engine. You can monitor per-recipient status in real time.
              </p>

              <div className="pt-4">
                <Button
                  onClick={() => {
                    if (createdBatchId) router.push(`/dashboard/bulk-send/${createdBatchId}`);
                    else setShowWizard(false);
                  }}
                  className="bg-[#1A56DB] hover:bg-blue-700 text-white font-semibold gap-1.5"
                >
                  <Eye className="h-4 w-4" /> View Batch Status & Progress
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* MAIN BULK SEND BATCHES TABLE VIEW */
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Recent Bulk Send Batches</h2>
            <span className="text-xs text-slate-400 font-medium">{batches.length} total batches</span>
          </div>

          {batches.length === 0 ? (
            <div className="text-center py-16 space-y-3">
              <Layers className="h-10 w-10 text-slate-300 mx-auto" />
              <h3 className="text-sm font-bold text-slate-800">No Bulk Send Batches Yet</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Upload a CSV recipient list and issue mass signature requests using your templates.
              </p>
              <Button
                size="sm"
                className="bg-[#1A56DB]"
                onClick={() => {
                  setShowWizard(true);
                  setStep(1);
                }}
              >
                <Plus className="h-4 w-4 mr-1.5" /> Start First Bulk Send
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 text-xs">
              {batches.map((b) => {
                const isCompleted = b.status === "COMPLETED";
                const isPartial = b.status === "COMPLETED_WITH_ERRORS";
                const isFailed = b.status === "FAILED";

                return (
                  <div key={b.id} className="p-4 hover:bg-slate-50 flex items-center justify-between gap-4 transition-colors">
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/dashboard/bulk-send/${b.id}`}
                          className="font-bold text-slate-900 hover:text-[#1A56DB] truncate"
                        >
                          {b.name}
                        </Link>
                        <span
                          className={cn(
                            "font-semibold text-[10px] px-2 py-0.5 rounded-full shrink-0",
                            isCompleted
                              ? "bg-emerald-100 text-emerald-800"
                              : isPartial
                              ? "bg-amber-100 text-amber-800"
                              : isFailed
                              ? "bg-red-100 text-red-800"
                              : "bg-blue-100 text-blue-800"
                          )}
                        >
                          {b.status}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 font-medium">
                        Template: <strong className="text-slate-600">{b.templateName}</strong> &bull; Created {b.createdAt ? formatRelativeDate(new Date(b.createdAt)) : ""}
                      </p>
                    </div>

                    {/* Progress Bar & Counters */}
                    <div className="w-48 hidden sm:block space-y-1">
                      <div className="flex justify-between text-[11px] text-slate-500 font-medium">
                        <span>{b.sentRows} sent</span>
                        <span>{b.totalRows} total</span>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all",
                            isPartial ? "bg-amber-500" : isFailed ? "bg-red-500" : "bg-emerald-500"
                          )}
                          style={{
                            width: `${b.totalRows > 0 ? Math.round((b.sentRows / b.totalRows) * 100) : 0}%`,
                          }}
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {b.failedRows > 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={retryingBatchId === b.id}
                          onClick={() => handleRetryFailedBatch(b.id)}
                          className="h-7 text-xs font-semibold text-amber-700 border-amber-200 hover:bg-amber-50"
                        >
                          {retryingBatchId === b.id ? (
                            <Loader2 className="h-3 w-3 animate-spin mr-1" />
                          ) : (
                            <RefreshCw className="h-3 w-3 mr-1" />
                          )}
                          Retry Failed ({b.failedRows})
                        </Button>
                      )}

                      <Button asChild variant="outline" size="sm" className="h-7 text-xs font-semibold text-slate-700">
                        <Link href={`/dashboard/bulk-send/${b.id}`}>
                          <Eye className="h-3 w-3 mr-1" /> View Details
                        </Link>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
