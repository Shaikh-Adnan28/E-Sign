"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import {
  Plus,
  Search,
  Copy,
  FileText,
  Users,
  MoreVertical,
  Play,
  Pencil,
  Trash2,
  Archive,
  RotateCcw,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { EmptyState } from "@/components/shared/empty-state"
import { CreateTemplateModal } from "./create-template-modal"
import { UseTemplateModal } from "./use-template-modal"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { formatRelativeDate } from "@/lib/utils"

interface TemplateItem {
  id: string
  name: string
  description: string | null
  filename: string
  pageCount: number | null
  usageCount: number
  status: "ACTIVE" | "ARCHIVED"
  createdAt: string | Date
  updatedAt: string | Date
  roles: Array<{ id: string; roleName: string; order: number }>
  fields: Array<{ id: string; type: string }>
}

interface TemplatesResponse {
  data: TemplateItem[]
  total: number
  page: number
  totalPages: number
}

const TABS = [
  { key: "ACTIVE", label: "Active Templates" },
  { key: "ARCHIVED", label: "Archived" },
  { key: "ALL", label: "All Templates" },
] as const

export function TemplatesClient() {
  const router = useRouter()
  const [templates, setTemplates] = useState<TemplateItem[]>([])
  const [activeTab, setActiveTab] = useState<"ACTIVE" | "ARCHIVED" | "ALL">("ACTIVE")
  const [search, setSearch] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")
  const [isLoading, setIsLoading] = useState(true)

  // Modals
  const [createOpen, setCreateOpen] = useState(false)
  const [useTarget, setUseTarget] = useState<TemplateItem | null>(null)

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => {
      setDebouncedSearch(search)
    }, 300)
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current)
    }
  }, [search])

  const fetchTemplates = useCallback(async () => {
    setIsLoading(true)
    try {
      const params = new URLSearchParams({
        status: activeTab,
      })
      if (debouncedSearch) params.set("search", debouncedSearch)

      const res = await fetch(`/api/templates?${params.toString()}`)
      if (!res.ok) throw new Error("Failed to fetch templates")
      const json: TemplatesResponse = await res.json()
      setTemplates(json.data)
    } catch {
      // retain state
    } finally {
      setIsLoading(false)
    }
  }, [activeTab, debouncedSearch])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchTemplates()
  }, [fetchTemplates])

  async function handleDuplicate(templateId: string) {
    try {
      const res = await fetch(`/api/templates/${templateId}/duplicate`, { method: "POST" })
      if (!res.ok) return
      fetchTemplates()
    } catch {
      // silent
    }
  }

  async function handleArchiveToggle(template: TemplateItem) {
    const nextStatus = template.status === "ACTIVE" ? "ARCHIVED" : "ACTIVE"
    try {
      const res = await fetch(`/api/templates/${template.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      })
      if (!res.ok) return
      fetchTemplates()
    } catch {
      // silent
    }
  }

  async function handleDelete(templateId: string) {
    if (!confirm("Are you sure you want to delete this template?")) return
    try {
      const res = await fetch(`/api/templates/${templateId}`, { method: "DELETE" })
      if (!res.ok) return
      fetchTemplates()
    } catch {
      // silent
    }
  }

  const hasTemplates = templates.length > 0
  const isEmpty = !isLoading && !hasTemplates && !debouncedSearch

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/60">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Document Templates
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Create reusable document formats with predefined field placements and signer roles.
          </p>
        </div>
        <Button
          onClick={() => setCreateOpen(true)}
          className="bg-[#1A56DB] hover:bg-blue-700 text-white font-semibold text-xs h-9 px-4 shadow-sm shadow-blue-500/20 rounded-xl shrink-0"
        >
          <Plus className="h-3.5 w-3.5 mr-1.5 shrink-0" />
          <span>Create Template</span>
        </Button>
      </div>

      {/* Tabs & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1 border-b border-slate-200 sm:border-none">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-3.5 py-2 text-xs font-semibold whitespace-nowrap rounded-lg transition-all ${
                activeTab === tab.key
                  ? "bg-blue-50 text-[#1A56DB]"
                  : "text-slate-500 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative max-w-xs w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <Input
            placeholder="Search templates..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-8 text-xs bg-white"
          />
        </div>
      </div>

      {/* Body Grid */}
      {isLoading ? (
        <TemplatesGridSkeleton />
      ) : isEmpty ? (
        <EmptyState
          icon={Copy}
          heading="No templates yet"
          description="Create your first reusable template to streamline sending agreements and contracts."
          action={{ label: "Create Template", onClick: () => setCreateOpen(true) }}
          className="py-16"
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((tmpl) => (
            <div
              key={tmpl.id}
              className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-2xs hover:shadow-md hover:border-slate-300 transition-all flex flex-col justify-between space-y-4"
            >
              {/* Top Header */}
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="h-9 w-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                      <Copy className="h-4.5 w-4.5" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-slate-900 truncate">
                        {tmpl.name}
                      </h3>
                      <p className="text-[11px] text-slate-400 truncate flex items-center gap-1">
                        <FileText className="h-3 w-3" /> {tmpl.filename} ({tmpl.pageCount || 1} pages)
                      </p>
                    </div>
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-400">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40 text-xs">
                      <DropdownMenuItem onClick={() => setUseTarget(tmpl)}>
                        <Play className="h-3.5 w-3.5 mr-2 text-[#1A56DB]" /> Use Template
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => router.push(`/dashboard/templates/editor/${tmpl.id}`)}>
                        <Pencil className="h-3.5 w-3.5 mr-2" /> Edit Template
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDuplicate(tmpl.id)}>
                        <Copy className="h-3.5 w-3.5 mr-2" /> Duplicate
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleArchiveToggle(tmpl)}>
                        {tmpl.status === "ACTIVE" ? (
                          <>
                            <Archive className="h-3.5 w-3.5 mr-2" /> Archive
                          </>
                        ) : (
                          <>
                            <RotateCcw className="h-3.5 w-3.5 mr-2" /> Restore
                          </>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleDelete(tmpl.id)} className="text-red-600">
                        <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {tmpl.description && (
                  <p className="text-xs text-slate-500 mt-2.5 line-clamp-2">
                    {tmpl.description}
                  </p>
                )}
              </div>

              {/* Badges & Footer */}
              <div className="space-y-3 pt-3 border-t border-slate-100">
                <div className="flex items-center gap-2 flex-wrap text-[11px]">
                  <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold flex items-center gap-1">
                    <Users className="h-3 w-3 text-slate-500" />
                    {tmpl.roles?.length || 0} Roles
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-semibold">
                    {tmpl.fields?.length || 0} Fields
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold ml-auto">
                    Used {tmpl.usageCount} times
                  </span>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-[10px] text-slate-400 font-medium">
                    Updated {formatRelativeDate(new Date(tmpl.updatedAt))}
                  </span>

                  <Button
                    size="sm"
                    onClick={() => setUseTarget(tmpl)}
                    className="h-7 text-xs font-semibold bg-[#1A56DB] hover:bg-blue-700 text-white rounded-lg px-3"
                  >
                    <Play className="h-3 w-3 mr-1" /> Use Template
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      <CreateTemplateModal open={createOpen} onOpenChange={setCreateOpen} />
      {useTarget && (
        <UseTemplateModal
          open={!!useTarget}
          onOpenChange={(open) => !open && setUseTarget(null)}
          template={useTarget}
        />
      )}
    </div>
  )
}

function TemplatesGridSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="bg-white rounded-xl border border-slate-200 p-5 space-y-4 animate-pulse">
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-xl bg-slate-100 shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-3/4 rounded bg-slate-100" />
              <div className="h-3 w-1/2 rounded bg-slate-100" />
            </div>
          </div>
          <div className="h-10 rounded bg-slate-100" />
          <div className="h-8 rounded bg-slate-100 pt-2" />
        </div>
      ))}
    </div>
  )
}
