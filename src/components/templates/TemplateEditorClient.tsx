"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  PenLine,
  Type,
  Calendar,
  CheckSquare,
  AlignLeft,
  ChevronLeft,
  ZoomIn,
  ZoomOut,
  Save,
  Play,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UseTemplateModal } from "./use-template-modal";

type FieldType = "SIGNATURE" | "INITIALS" | "TEXT" | "DATE" | "CHECKBOX";

interface TemplateRoleInfo {
  id: string;
  roleName: string;
  order: number;
}

interface TemplateLocalField {
  id: string;
  roleId: string | null;
  type: FieldType;
  pageNumber: number;
  x: number; // 0-1 normalized
  y: number;
  width: number;
  height: number;
  required: boolean;
  placeholder?: string;
}

interface TemplateEditorClientProps {
  templateId: string;
  templateName: string;
  pageCount: number;
  initialRoles: TemplateRoleInfo[];
  initialFields: TemplateLocalField[];
}

const FIELD_TYPES: { type: FieldType; label: string; icon: typeof PenLine; defaultW: number; defaultH: number }[] = [
  { type: "SIGNATURE", label: "Signature", icon: PenLine, defaultW: 0.25, defaultH: 0.08 },
  { type: "INITIALS", label: "Initials", icon: Type, defaultW: 0.15, defaultH: 0.06 },
  { type: "TEXT", label: "Text Field", icon: AlignLeft, defaultW: 0.3, defaultH: 0.04 },
  { type: "DATE", label: "Date Signed", icon: Calendar, defaultW: 0.2, defaultH: 0.04 },
  { type: "CHECKBOX", label: "Checkbox", icon: CheckSquare, defaultW: 0.05, defaultH: 0.04 },
];

const ROLE_COLORS = [
  "border-blue-500 bg-blue-50/90 text-blue-800",
  "border-purple-500 bg-purple-50/90 text-purple-800",
  "border-emerald-500 bg-emerald-50/90 text-emerald-800",
  "border-amber-500 bg-amber-50/90 text-amber-800",
  "border-rose-500 bg-rose-50/90 text-rose-800",
];

export default function TemplateEditorClient({
  templateId,
  templateName,
  pageCount,
  initialRoles,
  initialFields,
}: TemplateEditorClientProps) {
  const router = useRouter();
  const canvasRef = useRef<HTMLDivElement>(null);

  const [roles, setRoles] = useState<TemplateRoleInfo[]>(initialRoles);
  const [fields, setFields] = useState<TemplateLocalField[]>(initialFields);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [selectedTool, setSelectedTool] = useState<FieldType | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [zoom, setZoom] = useState(1.0);
  const [activeTab, setActiveTab] = useState<"fields" | "roles">("fields");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [useModalOpen, setUseModalOpen] = useState(false);
  const [newRoleName, setNewRoleName] = useState("");

  const pageSize = { width: 620 * zoom, height: 800 * zoom };

  function handleAddField(type: FieldType, clientX: number, clientY: number) {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const ft = FIELD_TYPES.find((f) => f.type === type)!;

    const rawX = (clientX - rect.left) / pageSize.width;
    const rawY = (clientY - rect.top) / pageSize.height;

    const x = Math.max(0, Math.min(1 - ft.defaultW, rawX));
    const y = Math.max(0, Math.min(1 - ft.defaultH, rawY));

    const newField: TemplateLocalField = {
      id: `tf-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      roleId: roles[0]?.id ?? null,
      type,
      pageNumber: currentPage,
      x,
      y,
      width: ft.defaultW,
      height: ft.defaultH,
      required: true,
    };

    setFields((prev) => [...prev, newField]);
    setSelectedFieldId(newField.id);
    setSelectedTool(null);
  }

  function handleUpdateField(id: string, updates: Partial<TemplateLocalField>) {
    setFields((prev) => prev.map((f) => (f.id === id ? { ...f, ...updates } : f)));
  }

  function handleDeleteField(id: string) {
    setFields((prev) => prev.filter((f) => f.id !== id));
    if (selectedFieldId === id) setSelectedFieldId(null);
  }

  function handleAddRole() {
    if (!newRoleName.trim()) return;
    const newRole: TemplateRoleInfo = {
      id: `role-${Date.now()}`,
      roleName: newRoleName.trim(),
      order: roles.length + 1,
    };
    setRoles((prev) => [...prev, newRole]);
    setNewRoleName("");
  }

  async function handleSaveTemplate() {
    setSaveStatus("saving");
    try {
      await fetch(`/api/templates/${templateId}/fields`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      });
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
    } catch {
      setSaveStatus("idle");
    }
  }

  const selectedField = fields.find((f) => f.id === selectedFieldId);

  return (
    <div className="flex flex-col h-screen bg-slate-100 overflow-hidden">
      {/* ── Top Header Bar ─────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-4 py-2.5 bg-white border-b border-slate-200 shadow-2xs z-20 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/dashboard/templates")}
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
          >
            <ChevronLeft size={16} /> Templates
          </button>
          <div className="w-px h-5 bg-slate-200" />
          <div>
            <h1 className="text-sm font-bold text-slate-900 truncate max-w-xs sm:max-w-md">
              {templateName}
            </h1>
            <span className="text-[10px] text-blue-600 font-bold uppercase tracking-wider">
              Template Preparation Editor
            </span>
          </div>
        </div>

        {/* Controls & Actions */}
        <div className="flex items-center gap-3">
          {/* Zoom controls */}
          <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1 border border-slate-200 text-xs">
            <button
              onClick={() => setZoom((z) => Math.max(0.6, z - 0.1))}
              className="p-1 text-slate-600 hover:text-slate-900"
            >
              <ZoomOut size={14} />
            </button>
            <span className="w-10 text-center font-mono text-[11px] font-bold text-slate-700">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => setZoom((z) => Math.min(1.6, z + 0.1))}
              className="p-1 text-slate-600 hover:text-slate-900"
            >
              <ZoomIn size={14} />
            </button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleSaveTemplate}
            disabled={saveStatus === "saving"}
            className="h-8 text-xs font-semibold border-slate-300"
          >
            <Save size={14} className="mr-1.5" />
            {saveStatus === "saving" ? "Saving..." : saveStatus === "saved" ? "Saved!" : "Save Template"}
          </Button>

          <Button
            size="sm"
            onClick={() => setUseModalOpen(true)}
            className="h-8 text-xs font-semibold bg-[#1A56DB] hover:bg-blue-700 text-white shadow-xs"
          >
            <Play size={14} className="mr-1.5" /> Use Template
          </Button>
        </div>
      </header>

      {/* ── Main Workspace ─────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Toolbar */}
        <aside className="w-56 bg-white border-r border-slate-200 p-3.5 flex flex-col justify-between shrink-0 overflow-y-auto">
          <div className="space-y-4">
            {/* Tabs: Fields / Roles */}
            <div className="flex rounded-lg bg-slate-100 p-1 text-xs">
              <button
                onClick={() => setActiveTab("fields")}
                className={`flex-1 py-1.5 font-bold rounded-md transition-all ${
                  activeTab === "fields" ? "bg-white text-[#1A56DB] shadow-2xs" : "text-slate-500"
                }`}
              >
                Fields
              </button>
              <button
                onClick={() => setActiveTab("roles")}
                className={`flex-1 py-1.5 font-bold rounded-md transition-all ${
                  activeTab === "roles" ? "bg-white text-[#1A56DB] shadow-2xs" : "text-slate-500"
                }`}
              >
                Roles ({roles.length})
              </button>
            </div>

            {activeTab === "fields" ? (
              <div className="space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Click or drag tools onto canvas
                </span>
                {FIELD_TYPES.map((tool) => {
                  const Icon = tool.icon;
                  const isSelected = selectedTool === tool.type;
                  return (
                    <button
                      key={tool.type}
                      onClick={() => setSelectedTool(isSelected ? null : tool.type)}
                      className={`w-full flex items-center gap-3 p-2.5 rounded-xl border text-xs font-semibold text-left transition-all ${
                        isSelected
                          ? "border-[#1A56DB] bg-blue-50/80 text-[#1A56DB] ring-2 ring-blue-500/20"
                          : "border-slate-200/80 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      <div className="h-7 w-7 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
                        <Icon size={14} />
                      </div>
                      <span>{tool.label}</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-3">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Template Signer Roles
                </span>

                <div className="space-y-2">
                  {roles.map((r, idx) => (
                    <div
                      key={r.id}
                      className={`p-2.5 rounded-xl border text-xs flex items-center justify-between ${
                        ROLE_COLORS[idx % ROLE_COLORS.length]
                      }`}
                    >
                      <span className="font-bold truncate">
                        #{r.order}: {r.roleName}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="pt-2 border-t border-slate-100 space-y-2">
                  <Label className="text-[11px] font-bold text-slate-600">Add New Role</Label>
                  <div className="flex gap-1.5">
                    <Input
                      placeholder="e.g. Buyer"
                      value={newRoleName}
                      onChange={(e) => setNewRoleName(e.target.value)}
                      className="h-8 text-xs bg-white"
                    />
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleAddRole}
                      className="h-8 px-2.5 bg-[#1A56DB] hover:bg-blue-700 text-white"
                    >
                      <Plus size={14} />
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-slate-100 text-[11px] text-slate-400 font-medium text-center">
            {fields.length} reusable fields placed
          </div>
        </aside>

        {/* Center PDF Canvas */}
        <main className="flex-1 flex flex-col items-center justify-start p-6 overflow-auto relative">
          <div
            ref={canvasRef}
            onClick={(e) => {
              if (selectedTool) {
                handleAddField(selectedTool, e.clientX, e.clientY);
              }
            }}
            style={{ width: pageSize.width, height: pageSize.height }}
            className={`bg-white rounded-xl shadow-lg border border-slate-200/90 relative transition-all ${
              selectedTool ? "cursor-crosshair ring-2 ring-blue-500/30" : "cursor-default"
            }`}
          >
            {/* Mock PDF Document Page Background */}
            <div className="p-8 space-y-4 opacity-25 select-none pointer-events-none">
              <div className="h-6 bg-slate-300 rounded w-2/3" />
              <div className="h-4 bg-slate-200 rounded w-full" />
              <div className="h-4 bg-slate-200 rounded w-5/6" />
              <div className="h-4 bg-slate-200 rounded w-4/6" />
              <div className="h-32 bg-slate-100 rounded border border-dashed border-slate-300 my-8" />
              <div className="h-4 bg-slate-200 rounded w-full" />
              <div className="h-4 bg-slate-200 rounded w-3/4" />
            </div>

            {/* Field Overlays */}
            {fields
              .filter((f) => f.pageNumber === currentPage)
              .map((field) => {
                const roleIdx = roles.findIndex((r) => r.id === field.roleId);
                const colorClass = roleIdx >= 0 ? ROLE_COLORS[roleIdx % ROLE_COLORS.length] : "border-slate-400 bg-slate-100 text-slate-700";
                const isSelected = selectedFieldId === field.id;
                const roleName = roles.find((r) => r.id === field.roleId)?.roleName ?? "Unassigned";

                return (
                  <div
                    key={field.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedFieldId(field.id);
                    }}
                    style={{
                      left: `${field.x * 100}%`,
                      top: `${field.y * 100}%`,
                      width: `${field.width * 100}%`,
                      height: `${field.height * 100}%`,
                    }}
                    className={`absolute rounded-lg border-2 flex items-center justify-between px-2 text-xs font-bold transition-all shadow-2xs ${colorClass} ${
                      isSelected ? "ring-2 ring-blue-600 ring-offset-1 z-10" : ""
                    }`}
                  >
                    <span className="truncate">{field.type}</span>
                    <span className="text-[10px] opacity-80 truncate ml-1">{roleName}</span>
                  </div>
                );
              })}
          </div>

          {/* Page Navigation */}
          {pageCount > 1 && (
            <div className="mt-4 flex items-center gap-2 bg-white px-3 py-1.5 rounded-full border border-slate-200 shadow-2xs text-xs font-semibold">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                className="h-6 w-6 p-0"
              >
                &larr;
              </Button>
              <span>
                Page {currentPage} of {pageCount}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.min(pageCount, p + 1))}
                disabled={currentPage >= pageCount}
                className="h-6 w-6 p-0"
              >
                &rarr;
              </Button>
            </div>
          )}
        </main>

        {/* Right Properties Panel */}
        <aside className="w-64 bg-white border-l border-slate-200 p-4 shrink-0 overflow-y-auto">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
            Field Properties
          </h2>

          {selectedField ? (
            <div className="space-y-4">
              {/* Type */}
              <div className="space-y-1">
                <Label className="text-[11px] font-semibold text-slate-500">Field Type</Label>
                <div className="text-xs font-bold text-slate-900 bg-slate-50 p-2 rounded-lg border border-slate-200">
                  {selectedField.type}
                </div>
              </div>

              {/* Role Assignment Dropdown */}
              <div className="space-y-1">
                <Label className="text-[11px] font-semibold text-slate-500">Assigned Role</Label>
                <select
                  value={selectedField.roleId ?? ""}
                  onChange={(e) => handleUpdateField(selectedField.id, { roleId: e.target.value || null })}
                  className="w-full h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-900 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="">Unassigned</option>
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      #{r.order}: {r.roleName}
                    </option>
                  ))}
                </select>
              </div>

              {/* Required Toggle */}
              <div className="flex items-center justify-between pt-1">
                <Label className="text-xs font-semibold text-slate-700">Required Field</Label>
                <input
                  type="checkbox"
                  checked={selectedField.required}
                  onChange={(e) => handleUpdateField(selectedField.id, { required: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
              </div>

              <div className="pt-4 border-t border-slate-100">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDeleteField(selectedField.id)}
                  className="w-full h-8 text-xs font-semibold"
                >
                  <Trash2 size={14} className="mr-1.5" /> Delete Field
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-slate-400 text-xs">
              Select a field on the canvas to configure properties or role assignments.
            </div>
          )}
        </aside>
      </div>

      {/* Use Template Modal */}
      <UseTemplateModal
        open={useModalOpen}
        onOpenChange={setUseModalOpen}
        template={{ id: templateId, name: templateName, roles }}
      />
    </div>
  );
}
