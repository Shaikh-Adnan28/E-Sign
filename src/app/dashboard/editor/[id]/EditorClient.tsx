"use client";

import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Save,
  Send,
  PenLine,
  Type,
  AlignLeft,
  Calendar,
  CheckSquare,
  Trash2,
  Users,
  FileText,
  X,
  Plus,
  Loader2,
} from "lucide-react";
import { useEditorStore, type LocalField, type FieldType } from "@/stores/editor-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;

// ─── Types ────────────────────────────────────────────────────────────────────
interface SignerInfo {
  id: string;
  name: string | null;
  email: string;
  order: number;
  status: string;
}

interface EditorClientProps {
  envelopeId: string;
  envelopeTitle: string;
  documentId: string;
  pageCount: number;
  initialFields: LocalField[];
  signers: SignerInfo[];
}

// Signer colors (cycling)
const SIGNER_COLORS = [
  "bg-blue-500 border-blue-600 text-blue-700 bg-blue-50",
  "bg-purple-500 border-purple-600 text-purple-700 bg-purple-50",
  "bg-emerald-500 border-emerald-600 text-emerald-700 bg-emerald-50",
  "bg-orange-500 border-orange-600 text-orange-700 bg-orange-50",
  "bg-pink-500 border-pink-600 text-pink-700 bg-pink-50",
];
const SIGNER_BORDER_COLORS = [
  "border-blue-400",
  "border-purple-400",
  "border-emerald-400",
  "border-orange-400",
  "border-pink-400",
];
const SIGNER_BG_BADGE = [
  "bg-blue-100 text-blue-700",
  "bg-purple-100 text-purple-700",
  "bg-emerald-100 text-emerald-700",
  "bg-orange-100 text-orange-700",
  "bg-pink-100 text-pink-700",
];

// ─── Field Palette Item ───────────────────────────────────────────────────────
const FIELD_TYPES: { type: FieldType; label: string; icon: React.ReactNode; defaultW: number; defaultH: number }[] = [
  { type: "SIGNATURE", label: "Signature", icon: <PenLine size={18} />, defaultW: 0.2, defaultH: 0.06 },
  { type: "INITIALS",  label: "Initials",  icon: <Type size={18} />,    defaultW: 0.1, defaultH: 0.05 },
  { type: "TEXT",      label: "Text",      icon: <AlignLeft size={18} />, defaultW: 0.18, defaultH: 0.04 },
  { type: "DATE",      label: "Date",      icon: <Calendar size={18} />, defaultW: 0.14, defaultH: 0.04 },
  { type: "CHECKBOX",  label: "Checkbox",  icon: <CheckSquare size={18} />, defaultW: 0.04, defaultH: 0.04 },
];

// ─── Individual Field Overlay ─────────────────────────────────────────────────
function FieldOverlay({
  field,
  pagePixelW,
  pagePixelH,
  isSelected,
  signerIndex,
  onSelect,
  onUpdate,
  onDelete,
}: {
  field: LocalField;
  pagePixelW: number;
  pagePixelH: number;
  isSelected: boolean;
  signerIndex: number;
  onSelect: () => void;
  onUpdate: (updates: Partial<LocalField>) => void;
  onDelete: () => void;
}) {
  const left   = field.x * pagePixelW;
  const top    = field.y * pagePixelH;
  const width  = field.width * pagePixelW;
  const height = field.height * pagePixelH;

  const dragStart = useRef<{ mx: number; my: number; ox: number; oy: number } | null>(null);
  const resizeStart = useRef<{ mx: number; my: number; ow: number; oh: number } | null>(null);

  function onPointerDownMove(e: ReactPointerEvent) {
    e.stopPropagation();
    onSelect();
    dragStart.current = { mx: e.clientX, my: e.clientY, ox: field.x, oy: field.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onPointerMoveMove(e: ReactPointerEvent) {
    if (!dragStart.current) return;
    const dx = (e.clientX - dragStart.current.mx) / pagePixelW;
    const dy = (e.clientY - dragStart.current.my) / pagePixelH;
    onUpdate({
      x: Math.max(0, Math.min(1 - field.width, dragStart.current.ox + dx)),
      y: Math.max(0, Math.min(1 - field.height, dragStart.current.oy + dy)),
    });
  }

  function onPointerUpMove(e: ReactPointerEvent) {
    dragStart.current = null;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  }

  function onPointerDownResize(e: ReactPointerEvent) {
    e.stopPropagation();
    resizeStart.current = { mx: e.clientX, my: e.clientY, ow: field.width, oh: field.height };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onPointerMoveResize(e: ReactPointerEvent) {
    if (!resizeStart.current) return;
    const dw = (e.clientX - resizeStart.current.mx) / pagePixelW;
    const dh = (e.clientY - resizeStart.current.my) / pagePixelH;
    onUpdate({
      width: Math.max(0.03, Math.min(1 - field.x, resizeStart.current.ow + dw)),
      height: Math.max(0.02, Math.min(1 - field.y, resizeStart.current.oh + dh)),
    });
  }

  function onPointerUpResize(e: ReactPointerEvent) {
    resizeStart.current = null;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  }

  const borderColor = SIGNER_BORDER_COLORS[signerIndex % SIGNER_BORDER_COLORS.length] ?? "border-blue-400";
  const ft = FIELD_TYPES.find((f) => f.type === field.type);

  return (
    <div
      className={`absolute select-none group ${isSelected ? "z-20" : "z-10"}`}
      style={{ left, top, width, height }}
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
    >
      {/* Main field body */}
      <div
        className={`w-full h-full rounded border-2 ${isSelected ? borderColor + " shadow-md" : "border-dashed " + borderColor} bg-blue-50/60 flex items-center justify-center overflow-hidden cursor-move`}
        onPointerDown={onPointerDownMove}
        onPointerMove={onPointerMoveMove}
        onPointerUp={onPointerUpMove}
      >
        <span className="text-[10px] font-semibold text-slate-600 pointer-events-none select-none truncate px-1">
          {ft?.icon && <span className="inline mr-0.5">{ft.icon}</span>}
          {ft?.label}
        </span>
      </div>

      {/* Delete button (selected only) */}
      {isSelected && (
        <button
          className="absolute -top-3 -right-3 w-5 h-5 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center shadow z-30"
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
        >
          <X size={10} />
        </button>
      )}

      {/* Resize handle (bottom-right, selected only) */}
      {isSelected && (
        <div
          className="absolute bottom-0 right-0 w-3 h-3 bg-blue-500 rounded-sm cursor-se-resize z-30"
          onPointerDown={onPointerDownResize}
          onPointerMove={onPointerMoveResize}
          onPointerUp={onPointerUpResize}
        />
      )}
    </div>
  );
}

// ─── Recipients Panel ────────────────────────────────────────────────────────
function RecipientsPanel({
  envelopeId,
  signers,
  onSignersChange,
}: {
  envelopeId: string;
  signers: SignerInfo[];
  onSignersChange: (signers: SignerInfo[]) => void;
}) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");

  async function addSigner() {
    if (!email) return;
    setAdding(true);
    setError("");
    try {
      const res = await fetch(`/api/envelopes/${envelopeId}/signers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, name: name || undefined, order: signers.length }),
      });
      if (!res.ok) {
        const j = await res.json();
        setError(j.error ?? "Failed to add signer");
        return;
      }
      const signer = await res.json();
      onSignersChange([...signers, { id: signer.id, name: signer.name, email: signer.email, order: signer.order ?? 0, status: signer.status ?? "PENDING" }]);
      setEmail("");
      setName("");
    } finally {
      setAdding(false);
    }
  }

  async function removeSigner(signerId: string) {
    const res = await fetch(`/api/envelopes/${envelopeId}/signers/${signerId}`, { method: "DELETE" });
    if (res.ok || res.status === 204) {
      onSignersChange(signers.filter((s) => s.id !== signerId));
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-slate-500">Add people who need to sign this document.</p>
      <div className="flex flex-col gap-2">
        {signers.map((s, i) => (
          <div key={s.id} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg border ${SIGNER_BORDER_COLORS[i % SIGNER_BORDER_COLORS.length]}`}>
            <span className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center text-white ${SIGNER_BG_BADGE[i % SIGNER_BG_BADGE.length]}`}>
              {i + 1}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-slate-700 truncate">{s.name ?? s.email}</p>
              {s.name && <p className="text-[10px] text-slate-400 truncate">{s.email}</p>}
            </div>
            <button onClick={() => removeSigner(s.id)} className="text-slate-400 hover:text-red-500 transition-colors">
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-1.5 mt-1">
        <Input placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)} className="h-8 text-xs" type="email" />
        <Input placeholder="Name (optional)" value={name} onChange={(e) => setName(e.target.value)} className="h-8 text-xs" />
        {error && <p className="text-xs text-red-500">{error}</p>}
        <Button size="sm" onClick={addSigner} disabled={adding || !email} className="h-8 text-xs gap-1.5">
          {adding ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
          Add recipient
        </Button>
      </div>
    </div>
  );
}

// ─── Properties Panel ─────────────────────────────────────────────────────────
function PropertiesPanel({
  field,
  signers,
  onUpdate,
  onDelete,
}: {
  field: LocalField | null;
  signers: SignerInfo[];
  onUpdate: (id: string, updates: Partial<LocalField>) => void;
  onDelete: (id: string) => void;
}) {
  if (!field) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center gap-2 px-4">
        <FileText className="text-slate-300" size={32} />
        <p className="text-xs text-slate-400">Click a field on the canvas to edit its properties.</p>
      </div>
    );
  }

  const ft = FIELD_TYPES.find((f) => f.type === field.type);

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center gap-2">
        <span className="text-slate-500">{ft?.icon}</span>
        <h3 className="text-sm font-semibold text-slate-700">{ft?.label} Field</h3>
      </div>

      {/* Assign to signer */}
      <div className="flex flex-col gap-1">
        <Label className="text-xs text-slate-500">Assigned to</Label>
        <select
          className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-blue-500"
          value={field.signerId ?? ""}
          onChange={(e) => onUpdate(field.id, { signerId: e.target.value || null })}
        >
          <option value="">Unassigned</option>
          {signers.map((s, i) => (
            <option key={s.id} value={s.id}>
              {i + 1}. {s.name ?? s.email}
            </option>
          ))}
        </select>
      </div>

      {/* Required */}
      <div className="flex items-center gap-2">
        <input
          id="field-required"
          type="checkbox"
          checked={field.required}
          onChange={(e) => onUpdate(field.id, { required: e.target.checked })}
          className="w-4 h-4 accent-blue-500"
        />
        <Label htmlFor="field-required" className="text-xs text-slate-600">Required</Label>
      </div>

      {/* Position info */}
      <div className="bg-slate-50 rounded-lg p-2 text-[10px] text-slate-400 space-y-0.5">
        <p>Page {field.pageNumber}</p>
        <p>X: {(field.x * 100).toFixed(1)}% Y: {(field.y * 100).toFixed(1)}%</p>
        <p>W: {(field.width * 100).toFixed(1)}% H: {(field.height * 100).toFixed(1)}%</p>
      </div>

      <Button
        variant="destructive"
        size="sm"
        className="h-8 text-xs gap-1.5"
        onClick={() => onDelete(field.id)}
      >
        <Trash2 size={12} /> Delete field
      </Button>
    </div>
  );
}

// ─── Main Editor Client ───────────────────────────────────────────────────────
export default function EditorClient({
  envelopeId,
  envelopeTitle,
  documentId,
  pageCount,
  initialFields,
  signers: initialSigners,
}: EditorClientProps) {
  const router = useRouter();
  const canvasRef = useRef<HTMLDivElement>(null);

  const {
    init, reset, currentPage, setPage, zoom, setZoom,
    fields, addField, updateField, deleteField, selectField,
    selectedFieldId, saveStatus,
  } = useEditorStore();

  const [signers, setSigners] = useState<SignerInfo[]>(initialSigners);
  const [activeTab, setActiveTab] = useState<"fields" | "recipients">("fields");
  const [selectedTool, setSelectedTool] = useState<FieldType | null>(null);
  const [pageSize, setPageSize] = useState<{ width: number; height: number }>({ width: 600, height: 800 });
  const [sending, setSending] = useState(false);
  const [showSendModal, setShowSendModal] = useState(false);
  const [sendError, setSendError] = useState("");

  useEffect(() => {
    init({ documentId, envelopeId, pageCount, initialFields });
    return () => reset();
  }, [documentId, envelopeId, pageCount]);

  // Keyboard shortcuts
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.key === "Delete" || e.key === "Backspace") && selectedFieldId) {
        const target = e.target as HTMLElement;
        if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT") return;
        deleteField(selectedFieldId);
      }
      if (e.key === "Escape") selectField(null);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedFieldId]);

  function onCanvasClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!selectedTool || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / pageSize.width;
    const y = (e.clientY - rect.top) / pageSize.height;
    const ft = FIELD_TYPES.find((f) => f.type === selectedTool)!;
    addField({
      documentId,
      type: selectedTool,
      pageNumber: currentPage,
      x: Math.max(0, Math.min(1 - ft.defaultW, x - ft.defaultW / 2)),
      y: Math.max(0, Math.min(1 - ft.defaultH, y - ft.defaultH / 2)),
      width: ft.defaultW,
      height: ft.defaultH,
      required: true,
      signerId: signers[0]?.id ?? null,
    });
    setSelectedTool(null);
  }

  async function handleSend() {
    setSending(true);
    setSendError("");
    try {
      const res = await fetch(`/api/envelopes/${envelopeId}/send`, { method: "POST" });
      if (!res.ok) {
        const j = await res.json();
        setSendError(j.error ?? "Failed to send");
        return;
      }
      router.push(`/dashboard/documents/${envelopeId}`);
    } finally {
      setSending(false);
    }
  }

  const visibleFields = fields.filter(
    (f) => f.pageNumber === currentPage && !f._deleted
  );

  const selectedField = fields.find((f) => f.id === selectedFieldId) ?? null;

  const saveLabel: Record<typeof saveStatus, string> = {
    idle: "Unsaved",
    saving: "Saving…",
    saved: "Saved",
    error: "Save error",
  };
  const saveDot: Record<typeof saveStatus, string> = {
    idle: "bg-slate-300",
    saving: "bg-amber-400 animate-pulse",
    saved: "bg-emerald-400",
    error: "bg-red-400",
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50 overflow-hidden">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className="flex items-center gap-3 px-4 py-2 bg-white border-b border-slate-200 shadow-sm z-10 flex-shrink-0">
        <button
          onClick={() => router.push(`/dashboard/documents/${envelopeId}`)}
          className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ChevronLeft size={16} /> Back
        </button>
        <div className="w-px h-5 bg-slate-200" />
        <h1 className="text-sm font-semibold text-slate-800 truncate max-w-xs">{envelopeTitle}</h1>

        {/* Page nav */}
        <div className="flex items-center gap-1 ml-auto">
          <button className="p-1 hover:bg-slate-100 rounded" onClick={() => setPage(currentPage - 1)} disabled={currentPage <= 1}>
            <ChevronLeft size={14} />
          </button>
          <span className="text-xs text-slate-500 min-w-[70px] text-center">
            Page {currentPage} / {pageCount}
          </span>
          <button className="p-1 hover:bg-slate-100 rounded" onClick={() => setPage(currentPage + 1)} disabled={currentPage >= pageCount}>
            <ChevronRight size={14} />
          </button>
        </div>

        {/* Zoom */}
        <div className="flex items-center gap-1">
          <button className="p-1 hover:bg-slate-100 rounded" onClick={() => setZoom(zoom - 0.1)}>
            <ZoomOut size={14} />
          </button>
          <span className="text-xs text-slate-500 w-10 text-center">{Math.round(zoom * 100)}%</span>
          <button className="p-1 hover:bg-slate-100 rounded" onClick={() => setZoom(zoom + 0.1)}>
            <ZoomIn size={14} />
          </button>
        </div>

        {/* Save status */}
        <div className="flex items-center gap-1.5">
          <div className={`w-2 h-2 rounded-full ${saveDot[saveStatus]}`} />
          <span className="text-xs text-slate-400">{saveLabel[saveStatus]}</span>
        </div>

        {/* Send */}
        <Button
          size="sm"
          className="h-8 gap-1.5 text-xs"
          onClick={() => setShowSendModal(true)}
        >
          <Send size={13} /> Send for Signature
        </Button>
      </header>

      {/* ── Body ────────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar — Field palette + Recipients */}
        <aside className="w-48 flex-shrink-0 bg-white border-r border-slate-200 flex flex-col overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-slate-200">
            <button
              onClick={() => setActiveTab("fields")}
              className={`flex-1 py-2 text-xs font-medium transition-colors ${activeTab === "fields" ? "text-blue-600 border-b-2 border-blue-500" : "text-slate-500 hover:text-slate-700"}`}
            >
              Fields
            </button>
            <button
              onClick={() => setActiveTab("recipients")}
              className={`flex-1 py-2 text-xs font-medium transition-colors ${activeTab === "recipients" ? "text-blue-600 border-b-2 border-blue-500" : "text-slate-500 hover:text-slate-700"}`}
            >
              <span className="flex items-center justify-center gap-1">
                <Users size={11} /> People
                {signers.length > 0 && (
                  <span className="bg-blue-100 text-blue-600 rounded-full px-1 text-[9px] font-bold">{signers.length}</span>
                )}
              </span>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            {activeTab === "fields" ? (
              <div className="flex flex-col gap-1.5">
                <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide mb-1">Click to place</p>
                {FIELD_TYPES.map((ft) => (
                  <button
                    key={ft.type}
                    onClick={() => setSelectedTool(selectedTool === ft.type ? null : ft.type)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all border ${
                      selectedTool === ft.type
                        ? "bg-blue-50 text-blue-700 border-blue-300 shadow-sm"
                        : "text-slate-600 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    {ft.icon}
                    {ft.label}
                  </button>
                ))}
                {selectedTool && (
                  <p className="text-[10px] text-blue-500 mt-1 text-center">Click on the PDF to place</p>
                )}
              </div>
            ) : (
              <RecipientsPanel
                envelopeId={envelopeId}
                signers={signers}
                onSignersChange={setSigners}
              />
            )}
          </div>
        </aside>

        {/* Center — PDF Canvas */}
        <main
          className="flex-1 overflow-auto bg-slate-100 flex justify-center items-start p-6"
          onClick={() => { if (!selectedTool) selectField(null); }}
        >
          <div style={{ transform: `scale(${zoom})`, transformOrigin: "top center" }}>
            <div className="relative shadow-2xl rounded-sm overflow-hidden bg-white" style={{ width: pageSize.width, height: pageSize.height }}>
              {/* PDF Page */}
              <Document
                file={`/api/documents/${documentId}/file`}
                loading={
                  <div className="flex items-center justify-center w-full h-full bg-slate-100">
                    <Loader2 className="animate-spin text-slate-400" size={32} />
                  </div>
                }
                error={
                  <div className="flex items-center justify-center w-full h-full bg-slate-100">
                    <p className="text-sm text-slate-400">Could not load PDF</p>
                  </div>
                }
              >
                <Page
                  pageNumber={currentPage}
                  width={pageSize.width}
                  onRenderSuccess={(page) => {
                    setPageSize({ width: page.width, height: page.height });
                  }}
                  renderTextLayer={false}
                  renderAnnotationLayer={false}
                />
              </Document>

              {/* Field overlay canvas */}
              <div
                ref={canvasRef}
                className={`absolute inset-0 ${selectedTool ? "cursor-crosshair" : "cursor-default"}`}
                style={{ width: pageSize.width, height: pageSize.height }}
                onClick={onCanvasClick}
              >
                {visibleFields.map((field) => {
                  const signerIndex = signers.findIndex((s) => s.id === field.signerId);
                  return (
                    <FieldOverlay
                      key={field.id}
                      field={field}
                      pagePixelW={pageSize.width}
                      pagePixelH={pageSize.height}
                      isSelected={field.id === selectedFieldId}
                      signerIndex={signerIndex >= 0 ? signerIndex : 0}
                      onSelect={() => selectField(field.id)}
                      onUpdate={(updates) => updateField(field.id, updates)}
                      onDelete={() => deleteField(field.id)}
                    />
                  );
                })}
              </div>
            </div>
          </div>
        </main>

        {/* Right sidebar — Properties */}
        <aside className="w-56 flex-shrink-0 bg-white border-l border-slate-200 overflow-y-auto">
          <div className="px-4 py-3 border-b border-slate-100">
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Properties</h2>
          </div>
          <PropertiesPanel
            field={selectedField}
            signers={signers}
            onUpdate={updateField}
            onDelete={deleteField}
          />
        </aside>
      </div>

      {/* ── Send Modal ───────────────────────────────────────────────────────── */}
      {showSendModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Send for Signature</h2>
                <p className="text-sm text-slate-500 mt-0.5">Review and confirm before sending.</p>
              </div>
              <button onClick={() => setShowSendModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>

            <div className="bg-slate-50 rounded-xl p-4 mb-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Document</span>
                <span className="font-medium text-slate-800 truncate max-w-[180px]">{envelopeTitle}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Pages</span>
                <span className="font-medium text-slate-800">{pageCount}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Recipients</span>
                <span className="font-medium text-slate-800">{signers.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Fields</span>
                <span className="font-medium text-slate-800">{fields.filter((f) => !f._deleted).length}</span>
              </div>
            </div>

            {signers.length === 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 text-sm text-amber-700">
                ⚠ Add at least one recipient before sending.
              </div>
            )}

            {sendError && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 text-sm text-red-700">
                {sendError}
              </div>
            )}

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setShowSendModal(false)}>
                Cancel
              </Button>
              <Button
                className="flex-1 gap-1.5"
                onClick={handleSend}
                disabled={sending || signers.length === 0}
              >
                {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                Send now
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

