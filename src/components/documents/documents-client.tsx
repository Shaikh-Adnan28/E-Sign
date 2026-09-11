"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import Link from "next/link"
import {
  Search,
  FileText,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Eye,
  Bell,
  XCircle,
  Download,
  Plus,
  Filter,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { StatusBadge } from "@/components/documents/status-badge"
import { EmptyState } from "@/components/shared/empty-state"
import { TableSkeleton } from "@/components/shared/loading-skeleton"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { formatDate, getInitials } from "@/lib/utils"
import type { StatusType } from "@/components/documents/status-badge"
import { MOCK_ENVELOPES } from "@/lib/mock-dashboard-data"

interface SignerSummary {
  id?: string
  name: string | null
  email: string
  status?: string | null
}

interface EnvelopeSummary {
  id: string
  title: string
  status: string
  createdAt: string | Date | null
  signers: SignerSummary[]
}

interface ApiResponse {
  data: EnvelopeSummary[]
  total: number
  page: number
  totalPages: number
}

const TABS = [
  { key: "ALL", label: "All", statuses: [] },
  { key: "DRAFT", label: "Drafts", statuses: ["DRAFT"] },
  { key: "SENT", label: "Sent", statuses: ["SENT", "DELIVERED"] },
  {
    key: "WAITING",
    label: "Waiting",
    statuses: ["VIEWED", "PARTIALLY_SIGNED"],
  },
  { key: "COMPLETED", label: "Completed", statuses: ["COMPLETED"] },
  { key: "DECLINED", label: "Declined", statuses: ["DECLINED"] },
  { key: "EXPIRED", label: "Expired", statuses: ["EXPIRED", "CANCELLED"] },
] as const

type TabKey = (typeof TABS)[number]["key"]

const EMPTY_MESSAGES: Record<TabKey, { heading: string; description: string }> = {
  ALL: { heading: "No documents found", description: "Send your first document for signature to get started." },
  DRAFT: { heading: "No drafts saved", description: "Draft agreements appear here while preparing to send." },
  SENT: { heading: "No sent documents", description: "Documents you have sent out for signature show here." },
  WAITING: { heading: "Nothing waiting", description: "Documents waiting for signers show up here." },
  COMPLETED: { heading: "No completed documents", description: "Fully signed agreements appear here." },
  DECLINED: { heading: "No declined documents", description: "Declined requests show here." },
  EXPIRED: { heading: "No expired documents", description: "Expired requests show here." },
}

const SORT_OPTIONS = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "name_asc", label: "Title A–Z" },
  { value: "name_desc", label: "Title Z–A" },
] as const

export function DocumentsClient() {
  const [activeTab, setActiveTab] = useState<TabKey>("ALL")
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [sort, setSort] = useState<"newest" | "oldest" | "name_asc" | "name_desc">("newest")
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<ApiResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean
    title: string
    description: string
    action: () => void
    destructive: boolean
  }>({ open: false, title: "", description: "", action: () => {}, destructive: false })

  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 300)
    return () => {
      if (searchTimeout.current) clearTimeout(searchTimeout.current)
    }
  }, [search])

  useEffect(() => {
    setPage(1)
    setSelected(new Set())
  }, [activeTab, sort])

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const tab = TABS.find((t) => t.key === activeTab)
      const statusParam = tab && tab.statuses.length > 0 ? tab.statuses.join(",") : undefined

      const params = new URLSearchParams()
      if (statusParam) params.set("status", statusParam)
      if (debouncedSearch) params.set("search", debouncedSearch)
      params.set("sort", sort)
      params.set("page", String(page))
      params.set("limit", "20")

      const res = await fetch(`/api/documents?${params.toString()}`)
      if (!res.ok) throw new Error("Failed to load documents")
      const json: ApiResponse = await res.json()

      // Dev Mock Fallback if zero DB records
      if (json.total === 0 && !debouncedSearch && activeTab === "ALL" && process.env.NODE_ENV !== "production") {
        setData({
          data: MOCK_ENVELOPES.map((env) => ({
            id: env.id,
            title: env.title,
            status: env.status,
            createdAt: env.createdAt,
            signers: env.signers,
          })),
          total: MOCK_ENVELOPES.length,
          page: 1,
          totalPages: 1,
        })
      } else {
        setData(json)
      }
    } catch {
      // Dev Mock Fallback on error
      if (process.env.NODE_ENV !== "production") {
        setData({
          data: MOCK_ENVELOPES.map((env) => ({
            id: env.id,
            title: env.title,
            status: env.status,
            createdAt: env.createdAt,
            signers: env.signers,
          })),
          total: MOCK_ENVELOPES.length,
          page: 1,
          totalPages: 1,
        })
      } else {
        setError("Failed to load documents. Please try again.")
      }
    } finally {
      setLoading(false)
    }
  }, [activeTab, debouncedSearch, sort, page])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const toggleRow = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    if (!data) return
    if (selected.size === data.data.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(data.data.map((e) => e.id)))
    }
  }

  const envelopeList = data?.data ?? []

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/60">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Documents
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage all your signature requests, contracts, and legal agreements.
          </p>
        </div>
        <Button
          asChild
          className="bg-[#1A56DB] hover:bg-blue-700 text-white font-medium text-xs h-9 px-4 shadow-sm shadow-blue-500/20"
        >
          <Link href="/dashboard/send">
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Send document
          </Link>
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-slate-200 overflow-x-auto scrollbar-thin">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-3.5 py-2.5 text-xs font-semibold whitespace-nowrap border-b-2 transition-all ${
              activeTab === tab.key
                ? "border-[#1A56DB] text-[#1A56DB]"
                : "border-transparent text-slate-500 hover:text-slate-900 hover:border-slate-300"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search & Sort Controls */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <Input
            placeholder="Search documents by title or recipient..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 text-xs bg-white border-slate-200 focus:border-[#1A56DB]"
          />
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-slate-500 px-2">
            <Filter className="h-3.5 w-3.5 text-slate-400" /> Sort:
          </div>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as typeof sort)}
            className="h-9 rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-[#1A56DB]/20 focus:border-[#1A56DB]"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Bulk Action Bar */}
      {selected.size > 0 && (
        <div className="flex items-center justify-between rounded-xl bg-blue-50/90 border border-blue-200 px-4 py-2.5 shadow-2xs">
          <span className="text-xs font-bold text-[#1A56DB]">
            {selected.size} document{selected.size > 1 ? "s" : ""} selected
          </span>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="h-7 text-xs bg-white border-blue-200 text-blue-700 hover:bg-blue-50">
              <Bell className="h-3 w-3 mr-1" /> Send reminder
            </Button>
            <Button size="sm" variant="destructive" className="h-7 text-xs">
              <Trash2 className="h-3 w-3 mr-1" /> Delete
            </Button>
          </div>
        </div>
      )}

      {/* Data Table */}
      {loading ? (
        <TableSkeleton />
      ) : error ? (
        <div className="rounded-xl bg-red-50 border border-red-200 p-8 text-center space-y-3">
          <p className="text-xs text-red-700 font-medium">{error}</p>
          <Button variant="outline" size="sm" onClick={fetchData}>
            Try again
          </Button>
        </div>
      ) : envelopeList.length === 0 ? (
        <EmptyState
          icon={FileText}
          heading={EMPTY_MESSAGES[activeTab].heading}
          description={EMPTY_MESSAGES[activeTab].description}
          action={
            activeTab === "ALL"
              ? { label: "Send your first document", onClick: () => {} }
              : undefined
          }
          className="py-16"
        />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70 text-slate-500 font-semibold uppercase tracking-wider text-[11px]">
                  <th className="w-10 px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selected.size === envelopeList.length && envelopeList.length > 0}
                      onChange={toggleAll}
                      className="rounded border-slate-300 text-[#1A56DB] focus:ring-blue-300"
                    />
                  </th>
                  <th className="px-4 py-3 text-left">Document</th>
                  <th className="px-4 py-3 text-left hidden md:table-cell">Recipients</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left hidden sm:table-cell">Sent date</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {envelopeList.map((env) => (
                  <tr
                    key={env.id}
                    className={`hover:bg-slate-50/80 transition-colors ${
                      selected.has(env.id) ? "bg-blue-50/40" : ""
                    }`}
                  >
                    <td className="px-4 py-3.5">
                      <input
                        type="checkbox"
                        checked={selected.has(env.id)}
                        onChange={() => toggleRow(env.id)}
                        className="rounded border-slate-300 text-[#1A56DB] focus:ring-blue-300"
                      />
                    </td>

                    <td className="px-4 py-3.5 min-w-[200px]">
                      <Link
                        href={`/dashboard/documents/${env.id}`}
                        className="flex items-center gap-3 group"
                      >
                        <div className="h-8 w-8 rounded-lg bg-blue-50/80 text-[#1A56DB] border border-blue-100 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                          <FileText className="h-4 w-4" />
                        </div>
                        <span className="font-semibold text-slate-900 group-hover:text-[#1A56DB] transition-colors truncate max-w-[240px]">
                          {env.title}
                        </span>
                      </Link>
                    </td>

                    <td className="px-4 py-3.5 hidden md:table-cell">
                      <div className="flex items-center -space-x-1.5">
                        {env.signers.slice(0, 3).map((s, i) => (
                          <div
                            key={i}
                            title={s.name || s.email}
                            className="h-6 w-6 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold flex items-center justify-center border-2 border-white ring-1 ring-slate-200/60"
                          >
                            {getInitials(s.name || s.email)}
                          </div>
                        ))}
                        {env.signers.length > 3 && (
                          <div className="h-6 w-6 rounded-full bg-slate-200 text-slate-600 text-[9px] font-bold flex items-center justify-center border-2 border-white">
                            +{env.signers.length - 3}
                          </div>
                        )}
                      </div>
                    </td>

                    <td className="px-4 py-3.5">
                      <StatusBadge status={env.status as StatusType} />
                    </td>

                    <td className="px-4 py-3.5 text-slate-500 font-medium hidden sm:table-cell">
                      {env.createdAt ? formatDate(new Date(env.createdAt)) : "—"}
                    </td>

                    <td className="px-4 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          asChild
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-slate-400 hover:text-slate-600"
                          title="View details"
                        >
                          <Link href={`/dashboard/documents/${env.id}`}>
                            <Eye className="h-3.5 w-3.5" />
                          </Link>
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-slate-500 font-medium">
            Showing Page {data.page} of {data.totalPages} ({data.total} documents)
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1 || loading}
            >
              <ChevronLeft className="h-3.5 w-3.5 mr-1" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
              disabled={page === data.totalPages || loading}
            >
              Next
              <ChevronRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmDialog.open}
        onOpenChange={(open) => setConfirmDialog((d) => ({ ...d, open }))}
        title={confirmDialog.title}
        description={confirmDialog.description}
        confirmLabel="Confirm"
        onConfirm={confirmDialog.action}
        destructive={confirmDialog.destructive}
      />
    </div>
  )
}
