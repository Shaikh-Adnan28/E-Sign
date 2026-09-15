"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Plus, Search, Users, X, Download, Upload, Loader2, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { ContactCard } from "./contact-card"
import { AddContactModal, EditContactModal } from "./contact-modal"
import { DeleteContactDialog } from "./delete-contact-dialog"
import { ContactDetailModal } from "./contact-detail-modal"
import { GroupsView } from "./groups-view"
import { EmptyState } from "@/components/shared/empty-state"
import type { Contact } from "@/lib/db/schema"

interface ContactsResponse {
  data: Contact[]
  total: number
  page: number
  totalPages: number
}

interface GroupSummary {
  id: string
  name: string
  memberCount: number
}

export function ContactsClient() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [isLoading, setIsLoading] = useState(true)

  // Filters & Sorting
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [selectedTagFilter, setSelectedTagFilter] = useState("")
  const [selectedGroupFilter, setSelectedGroupFilter] = useState("")
  const [sort, setSort] = useState<"name_asc" | "name_desc" | "newest" | "oldest" | "recently_used">("name_asc")

  // Main Tabs: Contacts vs Groups
  const [activeTab, setActiveTab] = useState<"contacts" | "groups">("contacts")

  // Groups list for filter dropdown & bulk assignment
  const [availableGroups, setAvailableGroups] = useState<GroupSummary[]>([])

  // Selection & Bulk Actions
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([])
  const [bulkTagModalOpen, setBulkTagModalOpen] = useState(false)
  const [bulkTagAction, setBulkTagAction] = useState<"add" | "remove">("add")
  const [bulkTagInput, setBulkTagInput] = useState("")
  const [bulkGroupModalOpen, setBulkGroupModalOpen] = useState(false)
  const [selectedTargetGroupId, setSelectedTargetGroupId] = useState("")
  const [isBulkExecuting, setIsBulkExecuting] = useState(false)

  // Modals
  const [addOpen, setAddOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Contact | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Contact | null>(null)
  const [detailTarget, setDetailTarget] = useState<Contact | null>(null)

  // CSV Import Wizard
  const [importOpen, setImportOpen] = useState(false)
  const [importStep, setImportStep] = useState<"upload" | "preview" | "done">("upload")
  const [importFile, setImportFile] = useState<File | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  const [importPreviewData, setImportPreviewData] = useState<{
    newCount: number
    duplicateCount: number
    invalidCount: number
    totalRows: number
    sampleRows: Array<{ name: string; email: string; company?: string; tags?: string }>
  } | null>(null)
  const [importResult, setImportResult] = useState<{ imported: number; skippedDuplicates: number; totalRows: number; errors?: string[] } | null>(null)

  // Debounce search
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 300)
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current)
    }
  }, [search])

  const fetchContacts = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams({
        sort,
        page: String(page),
        limit: "20",
      })
      if (debouncedSearch) params.set("search", debouncedSearch)
      if (selectedTagFilter) params.set("tag", selectedTagFilter)

      const res = await fetch(`/api/contacts?${params}`)
      if (!res.ok) throw new Error("Failed to fetch contacts")
      const json: ContactsResponse = await res.json()
      setContacts(json.data)
      setTotal(json.total)
      setTotalPages(json.totalPages)
    } catch {
      // retain state
    } finally {
      setIsLoading(false)
    }
  }, [debouncedSearch, sort, page, selectedTagFilter])

  const fetchGroupsList = useCallback(async () => {
    try {
      const res = await fetch("/api/contact-groups")
      if (res.ok) {
        const data = await res.json()
        setAvailableGroups(data || [])
      }
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchContacts()
    fetchGroupsList()
  }, [fetchContacts, fetchGroupsList])

  // Toggle single selection
  const handleToggleSelect = (id: string) => {
    setSelectedContactIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    )
  }

  // Toggle select all on current page
  const handleSelectAllCurrentPage = () => {
    const pageIds = contacts.map((c) => c.id)
    const allSelected = pageIds.every((id) => selectedContactIds.includes(id))
    if (allSelected) {
      setSelectedContactIds((prev) => prev.filter((id) => !pageIds.includes(id)))
    } else {
      setSelectedContactIds((prev) => Array.from(new Set([...prev, ...pageIds])))
    }
  }

  // Bulk Operations Handler
  const handleExecuteBulkAction = async (
    action: "add_tags" | "remove_tags" | "add_to_group" | "delete",
    payload?: { tags?: string[]; groupId?: string }
  ) => {
    if (selectedContactIds.length === 0) return
    setIsBulkExecuting(true)
    try {
      const res = await fetch("/api/contacts/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactIds: selectedContactIds,
          action,
          tags: payload?.tags,
          groupId: payload?.groupId,
        }),
      })

      if (res.ok) {
        setSelectedContactIds([])
        setBulkTagModalOpen(false)
        setBulkGroupModalOpen(false)
        fetchContacts()
      }
    } catch {
      // ignore
    } finally {
      setIsBulkExecuting(false)
    }
  }

  // CSV Import File Selected -> Parse Preview
  const handleFileChangeForImport = async (file: File | null) => {
    setImportFile(file)
    if (!file) {
      setImportPreviewData(null)
      return
    }

    const text = await file.text()
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
    if (lines.length <= 1) {
      setImportPreviewData(null)
      return
    }

    const header = lines[0].toLowerCase().split(",").map((h) => h.trim().replace(/^"|"$/g, ""))
    const emailIdx = header.findIndex((h) => h === "email" || h === "email address")
    const nameIdx = header.findIndex((h) => h === "name" || h === "full name")
    const companyIdx = header.findIndex((h) => h === "company" || h === "organization")
    const tagsIdx = header.findIndex((h) => h === "tags" || h === "tag")

    if (emailIdx === -1) {
      setImportPreviewData(null)
      return
    }

    let newCount = 0
    let duplicateCount = 0
    let invalidCount = 0
    const existingEmails = new Set(contacts.map((c) => c.email.toLowerCase()))
    const sampleRows: Array<{ name: string; email: string; company?: string; tags?: string }> = []

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(",").map((c) => c.trim().replace(/^"|"$/g, ""))
      const email = cols[emailIdx] || ""
      const name = nameIdx !== -1 ? cols[nameIdx] : email.split("@")[0]
      const company = companyIdx !== -1 ? cols[companyIdx] : ""
      const tagsStr = tagsIdx !== -1 ? cols[tagsIdx] : ""

      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        invalidCount++
        continue
      }

      if (existingEmails.has(email.toLowerCase())) {
        duplicateCount++
      } else {
        newCount++
      }

      if (sampleRows.length < 4) {
        sampleRows.push({ name, email, company, tags: tagsStr })
      }
    }

    setImportPreviewData({
      newCount,
      duplicateCount,
      invalidCount,
      totalRows: lines.length - 1,
      sampleRows,
    })
    setImportStep("preview")
  }

  // Execute CSV Import
  const handleConfirmCsvImport = async () => {
    if (!importFile) return
    setIsImporting(true)
    try {
      const formData = new FormData()
      formData.append("file", importFile)
      const res = await fetch("/api/contacts/import", {
        method: "POST",
        body: formData,
      })
      const json = await res.json()
      if (res.ok) {
        setImportResult(json)
        setImportStep("done")
        fetchContacts()
      } else {
        setImportResult({ imported: 0, skippedDuplicates: 0, totalRows: 0, errors: [json.error || "Import failed"] })
        setImportStep("done")
      }
    } catch {
      setImportResult({ imported: 0, skippedDuplicates: 0, totalRows: 0, errors: ["Unexpected import error"] })
      setImportStep("done")
    } finally {
      setIsImporting(false)
    }
  }

  const handleExportCsv = () => {
    const a = document.createElement("a")
    a.href = "/api/contacts/export"
    a.setAttribute("download", "")
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  const handleAddSuccess = () => {
    fetchContacts()
  }

  const handleEditSuccess = (updated: Contact) => {
    setContacts((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
    setEditTarget(null)
  }

  const handleDeleteSuccess = (id: string) => {
    setContacts((prev) => prev.filter((c) => c.id !== id))
    setTotal((t) => Math.max(0, t - 1))
    setDeleteTarget(null)
  }

  const hasContacts = contacts.length > 0
  const isEmpty = !isLoading && !hasContacts && !debouncedSearch && !selectedTagFilter

  return (
    <div className="space-y-6">
      {/* ── 1. CONTACTS HEADER ─────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Contacts</h1>
          <p className="mt-0.5 text-xs sm:text-sm text-slate-500 font-medium">
            Manage your reusable signers, tag segments, recipient groups, and address book
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={handleExportCsv} className="h-9 text-xs font-semibold">
            <Download className="mr-1.5 h-3.5 w-3.5" /> Export CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setImportOpen(true)
              setImportStep("upload")
              setImportFile(null)
              setImportPreviewData(null)
              setImportResult(null)
            }}
            className="h-9 text-xs font-semibold"
          >
            <Upload className="mr-1.5 h-3.5 w-3.5" /> Import CSV
          </Button>
          <Button onClick={() => setAddOpen(true)} className="h-9 text-xs bg-[#1A56DB] hover:bg-blue-700 text-white font-semibold">
            <Plus className="mr-1.5 h-3.5 w-3.5" /> Add Contact
          </Button>
        </div>
      </div>

      {/* ── MAIN TABS: Contacts | Groups ─────────────────────────────────────── */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab("contacts")}
          className={`py-2 px-4 text-xs font-bold border-b-2 transition-colors ${
            activeTab === "contacts" ? "border-[#1A56DB] text-[#1A56DB]" : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          Contacts ({total})
        </button>
        <button
          onClick={() => setActiveTab("groups")}
          className={`py-2 px-4 text-xs font-bold border-b-2 transition-colors ${
            activeTab === "groups" ? "border-[#1A56DB] text-[#1A56DB]" : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          Groups ({availableGroups.length})
        </button>
      </div>

      {activeTab === "groups" ? (
        /* Render Groups View */
        <GroupsView />
      ) : (
        /* Render Contacts View */
        <div className="space-y-4">
          {/* ── TOOLBAR: Search, Tag Filter, Group Filter, Recently Used ────── */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
            <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
              {/* Search */}
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <Input
                  placeholder="Search contacts..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 pr-8 text-xs h-9 bg-white border-slate-200"
                />
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Tags Filter */}
              <select
                value={selectedTagFilter}
                onChange={(e) => {
                  setSelectedTagFilter(e.target.value)
                  setPage(1)
                }}
                className="h-9 text-xs font-semibold bg-white border border-slate-200 hover:border-blue-300 rounded-lg px-2.5 text-slate-700 cursor-pointer outline-none"
              >
                <option value="">Tags ▾ (All)</option>
                <option value="Client">Client</option>
                <option value="Vendor">Vendor</option>
                <option value="Employee">Employee</option>
                <option value="Partner">Partner</option>
                <option value="VIP">VIP</option>
              </select>

              {/* Groups Filter */}
              <select
                value={selectedGroupFilter}
                onChange={(e) => {
                  setSelectedGroupFilter(e.target.value)
                  setPage(1)
                }}
                className="h-9 text-xs font-semibold bg-white border border-slate-200 hover:border-blue-300 rounded-lg px-2.5 text-slate-700 cursor-pointer outline-none"
              >
                <option value="">Groups ▾ (All)</option>
                {availableGroups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name} ({g.memberCount})
                  </option>
                ))}
              </select>

              {/* Sort / Recently Used */}
              <select
                value={sort}
                onChange={(e) => {
                  setSort(e.target.value as "name_asc" | "name_desc" | "newest" | "oldest" | "recently_used")
                  setPage(1)
                }}
                className="h-9 text-xs font-semibold bg-white border border-slate-200 hover:border-blue-300 rounded-lg px-2.5 text-slate-700 cursor-pointer outline-none"
              >
                <option value="name_asc">Name (A-Z)</option>
                <option value="name_desc">Name (Z-A)</option>
                <option value="recently_used">Recently Used ▾</option>
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
              </select>
            </div>

            {/* Select All Checkbox */}
            {hasContacts && (
              <button
                type="button"
                onClick={handleSelectAllCurrentPage}
                className="text-xs font-semibold text-slate-600 hover:text-blue-600 transition-colors flex items-center gap-1.5"
              >
                <input
                  type="checkbox"
                  checked={contacts.length > 0 && contacts.every((c) => selectedContactIds.includes(c.id))}
                  onChange={() => {}}
                  className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 cursor-pointer"
                />
                Select All
              </button>
            )}
          </div>

          {/* ── 4. BULK ACTIONS BAR ──────────────────────────────────────────────── */}
          {selectedContactIds.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs font-semibold text-blue-900 shadow-2xs animate-in fade-in slide-in-from-top-1 duration-150">
              <div className="flex items-center gap-2">
                <span className="bg-[#1A56DB] text-white px-2.5 py-0.5 rounded-full text-[11px] font-bold">
                  {selectedContactIds.length} selected
                </span>
                <button
                  onClick={() => setSelectedContactIds([])}
                  className="text-slate-500 hover:text-slate-800 underline text-[11px]"
                >
                  Clear selection
                </button>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setBulkTagAction("add")
                    setBulkTagInput("")
                    setBulkTagModalOpen(true)
                  }}
                  className="h-8 text-xs font-semibold bg-white"
                >
                  + Add Tag
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setBulkTagAction("remove")
                    setBulkTagInput("")
                    setBulkTagModalOpen(true)
                  }}
                  className="h-8 text-xs font-semibold bg-white"
                >
                  - Remove Tag
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setSelectedTargetGroupId(availableGroups[0]?.id || "")
                    setBulkGroupModalOpen(true)
                  }}
                  className="h-8 text-xs font-semibold bg-white"
                >
                  + Add to Group
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => handleExecuteBulkAction("delete")}
                  disabled={isBulkExecuting}
                  className="h-8 text-xs font-semibold"
                >
                  Delete Selected
                </Button>
              </div>
            </div>
          )}

          {/* ── CONTACTS GRID ───────────────────────────────────────────────────── */}
          {isLoading ? (
            <ContactsGridSkeleton />
          ) : isEmpty ? (
            <EmptyState
              icon={Users}
              heading="No contacts yet"
              description="Add your first contact to get started. You can use contacts when sending documents for signature."
              action={{ label: "Add Contact", onClick: () => setAddOpen(true) }}
              className="py-16"
            />
          ) : !hasContacts && (debouncedSearch || selectedTagFilter) ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="h-16 w-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                <Search className="h-7 w-7 text-slate-400" />
              </div>
              <h3 className="text-base font-semibold text-slate-900 mb-1">No results found</h3>
              <p className="text-sm text-slate-500">
                No contacts match your active filters.{" "}
                <button
                  onClick={() => {
                    setSearch("")
                    setSelectedTagFilter("")
                    setSelectedGroupFilter("")
                  }}
                  className="text-blue-600 hover:underline font-bold"
                >
                  Clear filters
                </button>
              </p>
            </div>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {contacts.map((contact) => (
                  <ContactCard
                    key={contact.id}
                    contact={contact}
                    selected={selectedContactIds.includes(contact.id)}
                    onToggleSelect={handleToggleSelect}
                    onClickDetail={setDetailTarget}
                    onEdit={setEditTarget}
                    onDelete={setDeleteTarget}
                  />
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <Pagination
                  page={page}
                  totalPages={totalPages}
                  onPageChange={setPage}
                />
              )}
            </>
          )}
        </div>
      )}

      {/* ── BULK TAG MODAL ────────────────────────────────────────────────────── */}
      <Dialog open={bulkTagModalOpen} onOpenChange={setBulkTagModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">
              {bulkTagAction === "add" ? "Add Tag to Selected Contacts" : "Remove Tag from Selected Contacts"}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Apply or remove tags across {selectedContactIds.length} selected contact rows.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Select or Enter Tag</Label>
              <Input
                placeholder="e.g. VIP, Client, Vendor"
                value={bulkTagInput}
                onChange={(e) => setBulkTagInput(e.target.value)}
                className="h-9 text-xs"
              />
            </div>

            <div className="flex flex-wrap gap-1.5">
              {["Client", "Vendor", "Employee", "Partner", "VIP"].map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setBulkTagInput(t)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                    bulkTagInput === t
                      ? "bg-[#1A56DB] text-white border-blue-600 font-bold"
                      : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button variant="outline" size="sm" onClick={() => setBulkTagModalOpen(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={!bulkTagInput.trim() || isBulkExecuting}
                onClick={() =>
                  handleExecuteBulkAction(
                    bulkTagAction === "add" ? "add_tags" : "remove_tags",
                    { tags: [bulkTagInput.trim()] }
                  )
                }
                className="bg-[#1A56DB] hover:bg-blue-700 text-white font-semibold"
              >
                {isBulkExecuting && <Loader2 size={13} className="mr-1.5 animate-spin" />}
                Apply
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── BULK ADD TO GROUP MODAL ───────────────────────────────────────────── */}
      <Dialog open={bulkGroupModalOpen} onOpenChange={setBulkGroupModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">Add Selected Contacts to Group</DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Add {selectedContactIds.length} contact(s) to a recipient group.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Target Group</Label>
              <select
                value={selectedTargetGroupId}
                onChange={(e) => setSelectedTargetGroupId(e.target.value)}
                className="w-full h-9 text-xs bg-white border border-slate-200 rounded-lg px-3 font-semibold"
              >
                {availableGroups.length === 0 ? (
                  <option value="">No groups available — create a group first</option>
                ) : (
                  availableGroups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name} ({g.memberCount} members)
                    </option>
                  ))
                )}
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button variant="outline" size="sm" onClick={() => setBulkGroupModalOpen(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={!selectedTargetGroupId || isBulkExecuting}
                onClick={() =>
                  handleExecuteBulkAction("add_to_group", { groupId: selectedTargetGroupId })
                }
                className="bg-[#1A56DB] hover:bg-blue-700 text-white font-semibold"
              >
                {isBulkExecuting && <Loader2 size={13} className="mr-1.5 animate-spin" />}
                Add to Group
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── 5. IMPORT CSV WIZARD MODAL ────────────────────────────────────────── */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Import Contacts CSV</DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Upload a .csv file containing columns: name, email, company, phone, tags
            </DialogDescription>
          </DialogHeader>

          {importStep === "upload" && (
            <div className="space-y-4 pt-2">
              <div className="border-2 border-dashed border-slate-200 rounded-2xl p-6 text-center bg-slate-50/50 hover:bg-blue-50/40 transition-colors">
                <Upload className="h-8 w-8 text-[#1A56DB] mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-800">Select CSV File</p>
                <p className="text-[11px] text-slate-400 mt-0.5">name, email, company, phone, tags</p>
                <Input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(e) => handleFileChangeForImport(e.target.files?.[0] || null)}
                  className="mt-4 text-xs h-9 bg-white cursor-pointer"
                />
              </div>

              <div className="p-3 bg-slate-100 rounded-xl text-[11px] text-slate-600 space-y-1 font-mono">
                <p className="font-bold text-slate-700 font-sans">Example Format:</p>
                <p>name,email,company,phone,tags</p>
                <p>&ldquo;Jane Smith&rdquo;,&ldquo;jane@example.com&rdquo;,&ldquo;ABC&rdquo;,&ldquo;+123&rdquo;,&ldquo;Client,VIP&rdquo;</p>
              </div>
            </div>
          )}

          {importStep === "preview" && importPreviewData && (
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <p className="text-lg font-bold text-emerald-700">{importPreviewData.newCount}</p>
                  <p className="text-[10px] text-emerald-600 font-semibold">New Contacts</p>
                </div>
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                  <p className="text-lg font-bold text-amber-700">{importPreviewData.duplicateCount}</p>
                  <p className="text-[10px] text-amber-600 font-semibold">Duplicates (Skip)</p>
                </div>
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
                  <p className="text-lg font-bold text-red-700">{importPreviewData.invalidCount}</p>
                  <p className="text-[10px] text-red-600 font-semibold">Invalid Rows</p>
                </div>
              </div>

              <div className="border border-slate-200 rounded-xl p-3 bg-white space-y-2">
                <p className="text-[11px] font-bold text-slate-700 uppercase">Sample Preview ({importPreviewData.totalRows} total rows)</p>
                <div className="space-y-1 max-h-36 overflow-y-auto divide-y divide-slate-100 text-xs">
                  {importPreviewData.sampleRows.map((r, idx) => (
                    <div key={idx} className="py-1 flex items-center justify-between">
                      <span className="font-bold text-slate-900 truncate">{r.name} ({r.email})</span>
                      {r.tags && <span className="text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">{r.tags}</span>}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <Button variant="outline" size="sm" onClick={() => setImportStep("upload")}>
                  Back
                </Button>
                <Button
                  size="sm"
                  onClick={handleConfirmCsvImport}
                  disabled={isImporting || importPreviewData.newCount === 0}
                  className="bg-[#1A56DB] hover:bg-blue-700 text-white font-semibold"
                >
                  {isImporting && <Loader2 size={13} className="mr-1.5 animate-spin" />}
                  Confirm Import ({importPreviewData.newCount})
                </Button>
              </div>
            </div>
          )}

          {importStep === "done" && importResult && (
            <div className="space-y-4 pt-2 text-xs">
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-center space-y-1">
                <Check className="h-8 w-8 text-emerald-600 mx-auto" />
                <p className="text-sm font-bold text-emerald-900">CSV Import Completed</p>
                <p className="text-emerald-700">Successfully imported <strong>{importResult.imported}</strong> new contacts into address book.</p>
                {importResult.skippedDuplicates > 0 && (
                  <p className="text-slate-500 text-[11px]">Skipped {importResult.skippedDuplicates} existing duplicate email rows.</p>
                )}
              </div>

              <div className="flex justify-end pt-2">
                <Button size="sm" onClick={() => setImportOpen(false)} className="bg-[#1A56DB] text-white">
                  Done
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── 9. CONTACT DETAIL MODAL ───────────────────────────────────────────── */}
      <ContactDetailModal
        contact={detailTarget}
        open={!!detailTarget}
        onOpenChange={(open) => !open && setDetailTarget(null)}
        onEdit={setEditTarget}
        onDelete={setDeleteTarget}
      />

      {/* ── ADD / EDIT / DELETE MODALS ────────────────────────────────────────── */}
      <AddContactModal open={addOpen} onOpenChange={setAddOpen} onSuccess={handleAddSuccess} />
      {editTarget && (
        <EditContactModal
          open={!!editTarget}
          onOpenChange={(open) => !open && setEditTarget(null)}
          contact={editTarget}
          onSuccess={handleEditSuccess}
        />
      )}
      {deleteTarget && (
        <DeleteContactDialog
          open={!!deleteTarget}
          onOpenChange={(open) => !open && setDeleteTarget(null)}
          contact={deleteTarget}
          onSuccess={handleDeleteSuccess}
        />
      )}
    </div>
  )
}

// ── SKELETON ───────────────────────────────────────────────────────────────

function ContactsGridSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="flex items-start gap-4 rounded-xl border border-slate-200 bg-white p-4">
          <div className="h-10 w-10 shrink-0 rounded-full bg-slate-100 animate-pulse" />
          <div className="flex-1 space-y-2 pt-0.5">
            <div className="h-4 w-32 rounded bg-slate-100 animate-pulse" />
            <div className="h-3 w-44 rounded bg-slate-100 animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ── PAGINATION ─────────────────────────────────────────────────────────────

interface PaginationProps {
  page: number
  totalPages: number
  onPageChange: (page: number) => void
}

function Pagination({ page, totalPages, onPageChange }: PaginationProps) {
  return (
    <div className="flex items-center justify-center gap-2 pt-2">
      <Button variant="outline" size="sm" onClick={() => onPageChange(page - 1)} disabled={page <= 1}>
        Previous
      </Button>
      <span className="text-xs text-slate-600 font-semibold">
        Page {page} of {totalPages}
      </span>
      <Button variant="outline" size="sm" onClick={() => onPageChange(page + 1)} disabled={page >= totalPages}>
        Next
      </Button>
    </div>
  )
}
