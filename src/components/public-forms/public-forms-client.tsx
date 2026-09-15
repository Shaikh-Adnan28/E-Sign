"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Globe,
  Plus,
  Copy,
  Check,
  ExternalLink,
  Search,
  FileText,
  AlertCircle,
  MoreVertical,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface PublicFormItem {
  id: string;
  name: string;
  description: string | null;
  token: string;
  status: "DRAFT" | "ACTIVE" | "PAUSED" | "EXPIRED" | "ARCHIVED";
  confirmationMessage: string | null;
  submissionsCount: number;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
  templateId: string;
  templateName: string;
  pageCount: number | null;
}

interface TemplateOption {
  id: string;
  name: string;
  description?: string;
  pageCount?: number;
}

export function PublicFormsClient() {
  const [forms, setForms] = useState<PublicFormItem[]>([]);
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  // Create Form Modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [formName, setFormName] = useState("");
  const [description, setDescription] = useState("");
  const [confirmationMessage, setConfirmationMessage] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [creating, setCreating] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Edit Form Modal
  const [editingForm, setEditingForm] = useState<PublicFormItem | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editConfirmationMsg, setEditConfirmationMsg] = useState("");
  const [editExpiresAt, setEditExpiresAt] = useState("");
  const [updating, setUpdating] = useState(false);

  const fetchForms = async () => {
    try {
      const res = await fetch("/api/public-forms");
      const data = await res.json();
      if (data.forms) {
        setForms(data.forms);
      }
    } catch (err) {
      console.error("Failed to load public forms:", err);
    }
  };

  useEffect(() => {
    let isMounted = true;

    async function loadInitialData() {
      try {
        const [formsRes, tmplRes] = await Promise.all([
          fetch("/api/public-forms"),
          fetch("/api/templates?status=ACTIVE"),
        ]);
        const formsData = await formsRes.json();
        const tmplData = await tmplRes.json();

        if (isMounted) {
          if (formsData.forms) setForms(formsData.forms);
          if (tmplData.data) setTemplates(tmplData.data);
        }
      } catch (err) {
        console.error("Failed to load initial data:", err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadInitialData();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleCopyLink = (token: string) => {
    const publicUrl = `${window.location.origin}/form/${token}`;
    navigator.clipboard.writeText(publicUrl);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2500);
  };

  const handleTemplateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const tId = e.target.value;
    setSelectedTemplateId(tId);
    const chosen = templates.find((t) => t.id === tId);
    if (chosen) {
      setFormName(chosen.name);
      setDescription(chosen.description || "");
    }
  };

  const handleCreatePublicForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTemplateId || !formName.trim()) return;

    try {
      setCreating(true);
      setErrorMsg("");
      const res = await fetch("/api/public-forms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: selectedTemplateId,
          name: formName.trim(),
          description: description.trim() || undefined,
          confirmationMessage: confirmationMessage.trim() || undefined,
          expiresAt: expiresAt || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to create public form");
      }

      setIsCreateOpen(false);
      setSelectedTemplateId("");
      setFormName("");
      setDescription("");
      setConfirmationMessage("");
      setExpiresAt("");
      fetchForms();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to create form");
    } finally {
      setCreating(false);
    }
  };

  const handleOpenEdit = (form: PublicFormItem) => {
    setEditingForm(form);
    setEditName(form.name);
    setEditDescription(form.description || "");
    setEditConfirmationMsg(form.confirmationMessage || "");
    setEditExpiresAt(
      form.expiresAt ? new Date(form.expiresAt).toISOString().slice(0, 16) : ""
    );
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingForm) return;

    try {
      setUpdating(true);
      const res = await fetch(`/api/public-forms/${editingForm.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          description: editDescription.trim() || null,
          confirmationMessage: editConfirmationMsg.trim() || null,
          expiresAt: editExpiresAt || null,
        }),
      });

      if (res.ok) {
        setEditingForm(null);
        fetchForms();
      }
    } catch (err) {
      console.error("Failed to update public form:", err);
    } finally {
      setUpdating(false);
    }
  };

  const handleToggleStatus = async (form: PublicFormItem) => {
    const action = form.status === "ACTIVE" ? "pause" : "activate";
    try {
      const res = await fetch(`/api/public-forms/${form.id}/${action}`, {
        method: "POST",
      });
      if (res.ok) {
        fetchForms();
      }
    } catch (err) {
      console.error(`Failed to ${action} public form:`, err);
    }
  };

  const handleArchive = async (id: string) => {
    try {
      const res = await fetch(`/api/public-forms/${id}/archive`, {
        method: "POST",
      });
      if (res.ok) {
        fetchForms();
      }
    } catch (err) {
      console.error("Failed to archive public form:", err);
    }
  };

  const filteredForms = forms.filter((f) =>
    f.name.toLowerCase().includes(search.toLowerCase()) ||
    f.templateName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 py-8">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <Globe className="h-6 w-6" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Public Forms</h1>
          </div>
          <p className="text-slate-600 text-sm">
            Create self-service signing links from your reusable templates. Anyone with the link can sign without a login.
          </p>
        </div>
        <Button
          onClick={() => setIsCreateOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium flex items-center gap-2 shadow-sm"
        >
          <Plus className="h-4 w-4" />
          Create Public Form
        </Button>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          placeholder="Search forms or templates..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 bg-white text-slate-900 border-slate-300"
        />
      </div>

      {/* Forms List */}
      {loading ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-500">
          Loading public forms...
        </div>
      ) : filteredForms.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
            <Globe className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-semibold text-slate-900">No public forms found</h3>
            <p className="text-slate-500 text-sm max-w-sm mx-auto">
              Create a shareable link from any of your active templates to accept signatures automatically.
            </p>
          </div>
          <Button
            onClick={() => setIsCreateOpen(true)}
            variant="outline"
            className="border-slate-300 text-slate-700 hover:bg-slate-50"
          >
            Create Your First Public Form
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredForms.map((form) => {
            const isPaused = form.status === "PAUSED";
            const isExpired = form.status === "EXPIRED" || (form.expiresAt && new Date(form.expiresAt) < new Date());

            return (
              <div
                key={form.id}
                className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow p-5 flex flex-col justify-between"
              >
                <div className="space-y-4">
                  {/* Top Bar: Title & Status */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <h3 className="font-bold text-slate-900 text-base line-clamp-1">
                        {form.name}
                      </h3>
                      <div className="flex items-center gap-1.5 text-xs text-slate-500">
                        <FileText className="h-3.5 w-3.5 text-slate-400" />
                        <span>Template: {form.templateName}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                          isExpired
                            ? "bg-amber-100 text-amber-800 border border-amber-300"
                            : isPaused
                            ? "bg-yellow-100 text-yellow-800 border border-yellow-300"
                            : "bg-emerald-100 text-emerald-800 border border-emerald-300"
                        }`}
                      >
                        {isExpired ? "EXPIRED" : form.status}
                      </span>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-slate-900">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleOpenEdit(form)}>
                            Edit Details
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleToggleStatus(form)}>
                            {form.status === "ACTIVE" ? "Pause Form" : "Activate Form"}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleArchive(form.id)}
                            className="text-red-600 focus:text-red-600"
                          >
                            Archive Form
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  {form.description && (
                    <p className="text-xs text-slate-600 line-clamp-2">
                      {form.description}
                    </p>
                  )}

                  {/* Submissions & Dates Stats */}
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-xs">
                    <div>
                      <span className="text-slate-500 block">Submissions</span>
                      <span className="font-semibold text-slate-900 text-sm">
                        {form.submissionsCount}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Expiration</span>
                      <span className="font-medium text-slate-700">
                        {form.expiresAt
                          ? new Date(form.expiresAt).toLocaleDateString()
                          : "No Limit"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="mt-5 pt-3 border-t border-slate-100 flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <Button
                      onClick={() => handleCopyLink(form.token)}
                      variant="outline"
                      className="flex-1 text-xs border-slate-300 text-slate-700 hover:bg-slate-50 font-medium h-9"
                    >
                      {copiedToken === form.token ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-emerald-600 mr-1.5" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5 text-slate-500 mr-1.5" />
                          Copy Link
                        </>
                      )}
                    </Button>

                    <Link
                      href={`/form/${form.token}`}
                      target="_blank"
                      className="inline-flex items-center justify-center p-2 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 text-xs font-medium h-9 w-9"
                      title="Open Public Link"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Link>
                  </div>

                  <Link
                    href={`/dashboard/public-forms/${form.id}/submissions`}
                    className="w-full text-center text-xs font-semibold text-blue-600 hover:text-blue-800 py-1"
                  >
                    View Submissions ({form.submissionsCount}) →
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Public Form Modal */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-md bg-white text-slate-900 border-slate-200">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900">
              Create Public Self-Service Form
            </DialogTitle>
          </DialogHeader>

          {errorMsg && (
            <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-lg text-xs flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleCreatePublicForm} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">
                Select Template *
              </Label>
              <select
                value={selectedTemplateId}
                onChange={handleTemplateChange}
                required
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
              >
                <option value="">-- Choose a Template --</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">
                Public Form Name *
              </Label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. Client Intake Form 2026"
                required
                className="bg-white text-slate-900 border-slate-300"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">
                Description (Optional)
              </Label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Instructions or details shown on the public signing landing page"
                className="bg-white text-slate-900 border-slate-300"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">
                Confirmation Message (Optional)
              </Label>
              <Input
                value={confirmationMessage}
                onChange={(e) => setConfirmationMessage(e.target.value)}
                placeholder="e.g. Thank you for completing your application!"
                className="bg-white text-slate-900 border-slate-300"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">
                Expiration Date (Optional)
              </Label>
              <Input
                type="datetime-local"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="bg-white text-slate-900 border-slate-300"
              />
            </div>

            <DialogFooter className="pt-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateOpen(false)}
                className="border-slate-300 text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={creating || !selectedTemplateId}
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium"
              >
                {creating ? "Creating..." : "Create & Generate Link"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Public Form Modal */}
      <Dialog open={!!editingForm} onOpenChange={(open) => !open && setEditingForm(null)}>
        <DialogContent className="sm:max-w-md bg-white text-slate-900 border-slate-200">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900">
              Edit Public Form Settings
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSaveEdit} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Form Name *</Label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                required
                className="bg-white text-slate-900 border-slate-300"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Description</Label>
              <Input
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                className="bg-white text-slate-900 border-slate-300"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Confirmation Message</Label>
              <Input
                value={editConfirmationMsg}
                onChange={(e) => setEditConfirmationMsg(e.target.value)}
                className="bg-white text-slate-900 border-slate-300"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Expiration Date</Label>
              <Input
                type="datetime-local"
                value={editExpiresAt}
                onChange={(e) => setEditExpiresAt(e.target.value)}
                className="bg-white text-slate-900 border-slate-300"
              />
            </div>

            <DialogFooter className="pt-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditingForm(null)}
                className="border-slate-300 text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={updating}
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium"
              >
                {updating ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
