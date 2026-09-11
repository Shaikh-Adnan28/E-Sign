"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Plus, Search, Users, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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

export function ContactsClient() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [sort] = useState<"name_asc" | "name_desc" | "newest" | "oldest">("name_asc")

  // Modals
  const [addOpen, setAddOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Contact | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Contact | null>(null)

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

  function handleAddSuccess(contact: Contact) {
    // Prepend if no search active and first page, otherwise re-fetch
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

  // ── Render ────────────────────────────────────────────────────

  const hasContacts = contacts.length > 0
  const isEmpty = !isLoading && !hasContacts && !debouncedSearch

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Contacts</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {total > 0 ? `${total} contact${total === 1 ? "" : "s"}` : "Manage your signers and contacts"}
          </p>
        </div>
        <Button onClick={() => setAddOpen(true)} className="shrink-0">
          <Plus className="mr-2 h-4 w-4" />
          Add Contact
        </Button>
      </div>

      {/* Search bar — only show if there are contacts or a search is active */}
      {(!isEmpty) && (
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="Search by name, email or company…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-9"
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

      {/* Modals */}
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
