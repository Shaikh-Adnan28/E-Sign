"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import {
  ChevronLeft,
  ChevronRight,
  PenLine,
  CheckSquare,
  AlignLeft,
  Calendar,
  Type,
  ChevronDown,
  Loader2,
  X,
  AlertTriangle,
} from "lucide-react";
import { SignatureModal } from "@/components/signing/signature-modal";
import { Button } from "@/components/ui/button";

pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;

// ─── Types ────────────────────────────────────────────────────────────────────
type FieldType = "SIGNATURE" | "INITIALS" | "TEXT" | "DATE" | "CHECKBOX";

interface SignerField {
  id: string;
  type: FieldType;
  pageNumber: number;
  x: number;
  y: number;
  width: number;
  height: number;
  required: boolean;
  value: string | null;
}

interface SignatureClientProps {
  token: string;
  signer: { id: string; name: string | null; email: string; status: string };
  envelope: { id: string; title: string; message: string | null };
  document: { id: string; filename: string; pageCount: number };
  fields: SignerField[];
}

// ─── Signing field overlay ────────────────────────────────────────────────────
function SigningFieldOverlay({
  field,
  pagePixelW,
  pagePixelH,
  onInteract,
}: {
  field: SignerField;
  pagePixelW: number;
  pagePixelH: number;
  onInteract: (field: SignerField) => void;
}) {
  const left   = field.x * pagePixelW;
  const top    = field.y * pagePixelH;
  const width  = field.width * pagePixelW;
  const height = field.height * pagePixelH;
  const filled = !!field.value;

  return (
    <div
      className={`absolute cursor-pointer transition-all border-2 rounded overflow-hidden flex items-center justify-center ${
        filled
          ? "border-emerald-400 bg-emerald-50"
          : "border-blue-400 bg-blue-50 hover:bg-blue-100 animate-pulse"
      }`}
      style={{ left, top, width, height }}
      onClick={() => onInteract(field)}
    >
      {filled ? (
        field.type === "SIGNATURE" || field.type === "INITIALS" ? (
          // Show the actual signature image
          // eslint-disable-next-line @next/next/no-img-element
          <img src={field.value!} alt="Signature" className="w-full h-full object-contain" />
        ) : field.type === "CHECKBOX" ? (
          <CheckSquare size={Math.min(width, height) * 0.6} className="text-emerald-500" />
        ) : (
          <span className="text-[11px] text-slate-700 truncate px-1">{field.value}</span>
        )
      ) : (
        <span className="text-[10px] font-semibold text-blue-600 truncate px-1 select-none">
          {field.type === "SIGNATURE" ? "Sign here" :
           field.type === "INITIALS" ? "Initials" :
           field.type === "DATE" ? "Date" :
           field.type === "CHECKBOX" ? "☐" : "Enter text"}
        </span>
      )}
    </div>
  );
}

// ─── Main Signature Client ────────────────────────────────────────────────────
export default function SignatureClient({
  token,
  signer,
  envelope,
  document,
  fields: initialFields,
}: SignatureClientProps) {
  const router = useRouter();
  const [fields, setFields] = useState<SignerField[]>(initialFields);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState({ width: 600, height: 800 });
  const [activeField, setActiveField] = useState<SignerField | null>(null);
  const [showSignModal, setShowSignModal] = useState(false);
  const [showDeclineModal, setShowDeclineModal] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [error, setError] = useState("");
  const [textInput, setTextInput] = useState("");
  const [showTextInput, setShowTextInput] = useState(false);

  const requiredFields = fields.filter((f) => f.required);
  const filledRequired = requiredFields.filter((f) => f.value);
  const progress = requiredFields.length === 0 ? 100 : Math.round((filledRequired.length / requiredFields.length) * 100);
  const allRequiredFilled = filledRequired.length === requiredFields.length;

  function updateField(id: string, value: string) {
    setFields((prev) => prev.map((f) => (f.id === id ? { ...f, value } : f)));
  }

  function handleInteract(field: SignerField) {
    setActiveField(field);
    if (field.type === "SIGNATURE" || field.type === "INITIALS") {
      setShowSignModal(true);
    } else if (field.type === "CHECKBOX") {
      updateField(field.id, field.value === "true" ? "" : "true");
    } else if (field.type === "TEXT" || field.type === "DATE") {
      setTextInput(field.value ?? "");
      setShowTextInput(true);
    }
  }

  function handleSignConfirm(dataUrl: string) {
    if (activeField) updateField(activeField.id, dataUrl);
    setShowSignModal(false);
    setActiveField(null);
  }

  function handleTextConfirm() {
    if (activeField) updateField(activeField.id, textInput);
    setShowTextInput(false);
    setActiveField(null);
  }

  function goToNextField() {
    const unfilled = fields.filter((f) => f.required && !f.value);
    if (unfilled.length === 0) return;
    const next = unfilled[0];
    setCurrentPage(next.pageNumber);
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/sign/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fieldValues: fields
            .filter((f) => f.value)
            .map((f) => ({ fieldId: f.id, value: f.value! })),
        }),
      });
      if (!res.ok) {
        const j = await res.json();
        setError(j.error ?? "Submission failed");
        return;
      }
      router.push(`/sign/${token}/done`);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDecline() {
    setDeclining(true);
    setError("");
    try {
      const res = await fetch(`/api/sign/${token}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: declineReason }),
      });
      if (!res.ok) {
        const j = await res.json();
        setError(j.error ?? "Could not decline");
        return;
      }
      router.push(`/sign/${token}/declined`);
    } finally {
      setDeclining(false);
    }
  }

  const visibleFields = fields.filter((f) => f.pageNumber === currentPage);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* ── Public Header ─────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
            <PenLine size={14} className="text-white" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-800 leading-tight">ESign</p>
            <p className="text-[10px] text-slate-400 leading-tight">Secure Signing</p>
          </div>
        </div>
        <div className="text-right hidden sm:block">
          <p className="text-sm font-medium text-slate-700 truncate max-w-xs">{envelope.title}</p>
          <p className="text-xs text-slate-400">Requested for {signer.name ?? signer.email}</p>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden max-w-5xl mx-auto w-full px-4 py-6 gap-6 flex-col lg:flex-row">
        {/* ── Left: PDF Viewer ───────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col gap-3">
          {/* Page nav */}
          <div className="flex items-center justify-between bg-white rounded-xl px-4 py-2 shadow-sm border border-slate-200">
            <button
              className="p-1 hover:bg-slate-100 rounded disabled:opacity-40"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-sm text-slate-500">
              Page {currentPage} of {document.pageCount}
            </span>
            <button
              className="p-1 hover:bg-slate-100 rounded disabled:opacity-40"
              onClick={() => setCurrentPage((p) => Math.min(document.pageCount, p + 1))}
              disabled={currentPage >= document.pageCount}
            >
              <ChevronRight size={16} />
            </button>
          </div>

          {/* PDF + field overlays */}
          <div className="relative shadow-2xl rounded-xl overflow-hidden bg-white border border-slate-200" style={{ width: pageSize.width, height: pageSize.height }}>
            <Document
              file={`/api/documents/${document.id}/file`}
              loading={<div className="flex items-center justify-center w-full h-full"><Loader2 className="animate-spin text-slate-300" size={32} /></div>}
            >
              <Page
                pageNumber={currentPage}
                width={pageSize.width}
                onRenderSuccess={(page) => setPageSize({ width: page.width, height: page.height })}
                renderTextLayer={false}
                renderAnnotationLayer={false}
              />
            </Document>
            <div className="absolute inset-0" style={{ width: pageSize.width, height: pageSize.height }}>
              {visibleFields.map((field) => (
                <SigningFieldOverlay
                  key={field.id}
                  field={field}
                  pagePixelW={pageSize.width}
                  pagePixelH={pageSize.height}
                  onInteract={handleInteract}
                />
              ))}
            </div>
          </div>
        </div>

        {/* ── Right: Sidebar ─────────────────────────────────────────────── */}
        <aside className="w-full lg:w-64 flex flex-col gap-4">
          {/* Progress */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-semibold text-slate-700">Progress</span>
              <span className="text-sm font-bold text-blue-600">{progress}%</span>
            </div>
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-slate-400 mt-1.5">
              {filledRequired.length} of {requiredFields.length} required fields completed
            </p>
          </div>

          {/* Message from sender */}
          {envelope.message && (
            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
              <p className="text-xs font-semibold text-blue-700 mb-1">Message from sender</p>
              <p className="text-xs text-blue-600">{envelope.message}</p>
            </div>
          )}

          {/* Fields list */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 flex flex-col gap-2">
            <p className="text-xs font-semibold text-slate-600 mb-1">Your fields</p>
            {fields.length === 0 ? (
              <p className="text-xs text-slate-400">No fields assigned to you.</p>
            ) : (
              fields.map((f) => (
                <button
                  key={f.id}
                  onClick={() => { setCurrentPage(f.pageNumber); handleInteract(f); }}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-left w-full transition-colors ${
                    f.value ? "bg-emerald-50 text-emerald-700" : "bg-slate-50 text-slate-600 hover:bg-blue-50 hover:text-blue-700"
                  }`}
                >
                  <span className="text-xs">
                    {f.type === "SIGNATURE" ? "✍" :
                     f.type === "INITIALS" ? "A" :
                     f.type === "TEXT" ? "T" :
                     f.type === "DATE" ? "📅" : "☐"}
                  </span>
                  <span className="text-xs font-medium capitalize">{f.type.toLowerCase()}</span>
                  <span className="text-[10px] text-slate-400 ml-auto">Pg {f.pageNumber}</span>
                  {f.value ? (
                    <span className="text-[10px] text-emerald-500 font-semibold">✓</span>
                  ) : f.required ? (
                    <span className="text-[10px] text-amber-500">*</span>
                  ) : null}
                </button>
              ))
            )}
          </div>

          {/* Next field button */}
          {!allRequiredFilled && (
            <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={goToNextField}>
              <ChevronDown size={13} /> Next required field
            </Button>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-600">
              {error}
            </div>
          )}

          {/* Submit / Decline */}
          <Button
            className="h-11 gap-1.5 font-semibold"
            onClick={handleSubmit}
            disabled={!allRequiredFilled || submitting}
          >
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <PenLine size={14} />}
            Finish Signing
          </Button>

          <button
            onClick={() => setShowDeclineModal(true)}
            className="text-xs text-slate-400 hover:text-red-500 transition-colors text-center"
          >
            Decline to Sign
          </button>
        </aside>
      </div>

      {/* ── Signature Modal ────────────────────────────────────────────────── */}
      {showSignModal && activeField && (
        <SignatureModal
          title={activeField.type === "INITIALS" ? "Draw your initials" : "Draw your signature"}
          onConfirm={handleSignConfirm}
          onClose={() => { setShowSignModal(false); setActiveField(null); }}
        />
      )}

      {/* ── Text/Date Input Modal ──────────────────────────────────────────── */}
      {showTextInput && activeField && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-slate-900">
                {activeField.type === "DATE" ? "Enter date" : "Enter text"}
              </h2>
              <button onClick={() => { setShowTextInput(false); setActiveField(null); }} className="text-slate-400 hover:text-slate-600">
                <X size={16} />
              </button>
            </div>
            <input
              type={activeField.type === "DATE" ? "date" : "text"}
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 mb-4"
              autoFocus
              defaultValue={activeField.type === "DATE" ? new Date().toISOString().slice(0, 10) : ""}
            />
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => { setShowTextInput(false); setActiveField(null); }}>Cancel</Button>
              <Button className="flex-1" onClick={handleTextConfirm} disabled={!textInput}>Save</Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Decline Modal ─────────────────────────────────────────────────── */}
      {showDeclineModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <AlertTriangle size={18} className="text-red-500" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">Decline to Sign</h2>
                <p className="text-xs text-slate-400">This action cannot be undone.</p>
              </div>
            </div>
            <p className="text-sm text-slate-600 mb-3">Please let the sender know why you are declining.</p>
            <textarea
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              placeholder="Optional reason for declining..."
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm h-24 resize-none focus:outline-none focus:border-red-400 focus:ring-2 focus:ring-red-400/20 mb-4"
            />
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setShowDeclineModal(false)}>Cancel</Button>
              <Button variant="destructive" className="flex-1 gap-1.5" onClick={handleDecline} disabled={declining}>
                {declining ? <Loader2 size={13} className="animate-spin" /> : null}
                Decline
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

