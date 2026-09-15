"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Plus, Search, Users, X, Download, Upload, History, CheckCircle, AlertCircle, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { ContactCard } from "./contact-card"
import { AddContactModal, EditContactModal } from "./contact-modal"
import { DeleteContactDialog } from "./delete-contact-dialog"
import { EmptyState } from "@/components/shared/empty-state"
import type { Contact } from "@/lib/db/schema"

interface ContactsResponse {
  data: Contact[]
  total: number
  page: number
  totalPages: number
}

interface ActivityEvent {
  id: string
  event: string
  actor: string
  createdAt: string
  meta: Record<string, unknown> | null
}

export function ContactsClient() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [sort] = useState<"name_asc" | "name_desc" | "newest" | "oldest">("name_asc")
  const [activeTab, setActiveTab] = useState<"all" | "groups">("all")

  // Modals
  const [addOpen, setAddOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Contact | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Contact | null>(null)

  // CSV Import Modal
  const [importOpen, setImportOpen] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ imported: number; skippedDuplicates: number; totalRows: number; errors?: string[] } | null>(null)

  // Activity Modal
  const [activityTarget, setActivityTarget] = useState<Contact | null>(null)
  const [activities, setActivities] = useState<ActivityEvent[]>([])
  const [loadingActivity, setLoadingActivity] = useState(false)

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

      const res = await fetch(`/api/contacts?${params}`)
      if (!res.ok) throw new Error("Failed to fetch contacts")
      const json: ContactsResponse = await res.json()
      setContacts(json.data)
      setTotal(json.total)
      setTotalPages(json.totalPages)
    } catch {
      // silently retain previous state on error
    } finally {
      setIsLoading(false)
    }
  }, [debouncedSearch, sort, page])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchContacts()
  }, [fetchContacts])

  // Fetch Activity when activity target changes
  useEffect(() => {
    if (!activityTarget) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoadingActivity(true)
    fetch(`/api/contacts/${activityTarget.id}/activity`)
      .then((res) => (res.ok ? res.json() : { events: [] }))
      .then((json) => setActivities(json.events || []))
      .catch(() => setActivities([]))
      .finally(() => setLoadingActivity(false))
  }, [activityTarget])

  function handleAddSuccess(contact: Contact) {
    if (!debouncedSearch && page === 1) {
      setContacts((prev) => [contact, ...prev])
      setTotal((t) => t + 1)
    } else {
      fetchContacts()
    }
  }

  function handleEditSuccess(updated: Contact) {
    setContacts((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
    setEditTarget(null)
  }

  function handleDeleteSuccess(id: string) {
    setContacts((prev) => prev.filter((c) => c.id !== id))
    setTotal((t) => Math.max(0, t - 1))
    setDeleteTarget(null)
  }

  async function handleImportSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!importFile) return
    setIsImporting(true)
    setImportResult(null)

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
        fetchContacts()
      } else {
        setImportResult({ imported: 0, skippedDuplicates: 0, totalRows: 0, errors: [json.error || "Import failed"] })
      }
    } catch {
      setImportResult({ imported: 0, skippedDuplicates: 0, totalRows: 0, errors: ["An unexpected error occurred during import"] })
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

  // ── Render ────────────────────────────────────────────────────

  const hasContacts = contacts.length > 0
  const isEmpty = !isLoading && !hasContacts && !debouncedSearch

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Address Book</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {total > 0 ? `${total} contact${total === 1 ? "" : "s"}` : "Manage reusable signers, tags, and groups"}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={handleExportCsv} className="h-9 text-xs">
            <Download className="mr-1.5 h-3.5 w-3.5" /> Export CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => { setImportOpen(true); setImportResult(null); setImportFile(null); }} className="h-9 text-xs">
            <Upload className="mr-1.5 h-3.5 w-3.5" /> Import CSV
          </Button>
          <Button onClick={() => setAddOpen(true)} className="h-9 text-xs bg-[#1A56DB] hover:bg-blue-700 text-white">
            <Plus className="mr-1.5 h-3.5 w-3.5" /> Add Contact
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab("all")}
          className={`py-2 px-4 text-xs font-semibold border-b-2 transition-colors ${
            activeTab === "all" ? "border-[#1A56DB] text-[#1A56DB]" : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          All Contacts ({total})
        </button>
      </div>

      {/* Search bar — only show if there are contacts or a search is active */}
      {!isEmpty && (
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Search by name, email, company or tag…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-9 text-xs h-9 bg-white"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

      {/* Body */}
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
      ) : !hasContacts && debouncedSearch ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="h-16 w-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
            <Search className="h-7 w-7 text-slate-400" />
          </div>
          <h3 className="text-base font-semibold text-slate-900 mb-1">No results found</h3>
          <p className="text-sm text-slate-500">
            No contacts match &ldquo;{debouncedSearch}&rdquo;.{" "}
            <button
              onClick={() => setSearch("")}
              className="text-blue-600 hover:underline"
            >
              Clear search
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
                onEdit={setEditTarget}
                onDelete={setDeleteTarget}
                onViewActivity={setActivityTarget}
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

      {/* CSV Import Modal */}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Import Contacts CSV</DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Upload a .csv file containing contact rows with headers: name, email, company, phone, tags, notes.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleImportSubmit} className="space-y-4 pt-2">
            <div className="space-y-2">
              <Input
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                className="text-xs h-9 cursor-pointer"
              />
            </div>

            {importResult && (
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1 text-xs">
                <p className="font-bold text-slate-800 flex items-center gap-1">
                  <CheckCircle className="h-4 w-4 text-emerald-600" /> Import Summary
                </p>
                <p className="text-slate-600">Imported: <strong>{importResult.imported}</strong> contacts</p>
                <p className="text-slate-600">Skipped Duplicates: <strong>{importResult.skippedDuplicates}</strong> contacts</p>
                {importResult.errors && importResult.errors.length > 0 && (
                  <div className="text-red-600 space-y-0.5 pt-1 border-t border-slate-200">
                    {importResult.errors.map((err, idx) => (
                      <p key={idx} className="flex items-center gap-1"><AlertCircle size={12} /> {err}</p>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setImportOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={!importFile || isImporting} className="bg-[#1A56DB] hover:bg-blue-700 text-white font-semibold">
                {isImporting && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                Import CSV
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Activity Timeline Modal */}
      <Dialog open={!!activityTarget} onOpenChange={(open) => !open && setActivityTarget(null)}>
        <DialogContent className="sm:max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <History className="h-4 w-4 text-[#1A56DB]" />
              Activity History: {activityTarget?.name}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Audit log of document interactions for {activityTarget?.email}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 pt-2">
            {loadingActivity ? (
              <div className="py-8 text-center text-xs text-slate-400">
                <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2 text-blue-600" />
                Loading activity history...
              </div>
            ) : activities.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500">
                No recorded envelope activity for this recipient yet.
              </div>
            ) : (
              <div className="space-y-2 border-l-2 border-slate-100 pl-3">
                {activities.map((act) => (
                  <div key={act.id} className="text-xs space-y-0.5 relative">
                    <div className="absolute -left-[17px] top-1 h-2 w-2 rounded-full bg-blue-500" />
                    <p className="font-bold text-slate-800">{act.event.replace(/_/g, " ")}</p>
                    <p className="text-[10px] text-slate-400">{new Date(act.createdAt).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Add / Edit / Delete Modals */}
      <AddContactModal
        open={addOpen}
        onOpenChange={setAddOpen}
        onSuccess={handleAddSuccess}
      />
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

// ── Skeleton ──────────────────────────────────────────────────────

function ContactsGridSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="flex items-start gap-4 rounded-xl border border-slate-200 bg-white p-4"
        >
          <div className="h-11 w-11 shrink-0 rounded-full bg-slate-100 animate-pulse" />
          <div className="flex-1 space-y-2 pt-0.5">
            <div className="h-4 w-32 rounded bg-slate-100 animate-pulse" />
            <div className="h-3 w-44 rounded bg-slate-100 animate-pulse" />
            <div className="h-3 w-24 rounded bg-slate-100 animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Pagination ────────────────────────────────────────────────────

interface PaginationProps {
  page: number
  totalPages: number
  onPageChange: (page: number) => void
}

function Pagination({ page, totalPages, onPageChange }: PaginationProps) {
  return (
    <div className="flex items-center justify-center gap-2 pt-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
      >
        Previous
      </Button>
      <span className="text-sm text-slate-600">
        Page {page} of {totalPages}
      </span>
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
      >
        Next
      </Button>
    </div>
  )
}
