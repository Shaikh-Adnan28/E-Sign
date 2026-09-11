"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  ChevronLeft,
  FileText,
  Download,
  Bell,
  XCircle,
  Trash2,
  CheckCircle2,
  Clock,
  Eye,
  PenLine,
  Send,
  Check,
  ShieldCheck,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { StatusBadge, StatusType } from "@/components/documents/status-badge"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { formatDate, formatRelativeDate, getInitials, cn } from "@/lib/utils"

const TIMELINE_STEPS = [
  { key: "CREATED", label: "Created", icon: FileText },
  { key: "SENT", label: "Sent", icon: Send },
  { key: "DELIVERED", label: "Delivered", icon: Bell },
  { key: "VIEWED", label: "Viewed", icon: Eye },
  { key: "SIGNED", label: "Signed", icon: PenLine },
  { key: "COMPLETED", label: "Completed", icon: CheckCircle2 },
]

const STATUS_ORDER: Record<string, number> = {
  DRAFT: 0,
  SENT: 1,
  DELIVERED: 2,
  VIEWED: 3,
  PARTIALLY_SIGNED: 4,
  COMPLETED: 5,
  DECLINED: -1,
  EXPIRED: -1,
  CANCELLED: -1,
}

function StatusTimeline({
  status,
  createdAt,
}: {
  status: string
  createdAt: Date | null
}) {
  const currentOrder = STATUS_ORDER[status] ?? 0
  const isTerminal = ["DECLINED", "EXPIRED", "CANCELLED"].includes(status)

  return (
    <div className="space-y-0">
      {TIMELINE_STEPS.map((step, i) => {
        const stepOrder = i
        const isDone = !isTerminal && currentOrder > stepOrder
        const isCurrent = !isTerminal && currentOrder === stepOrder

        return (
          <div key={step.key} className="flex items-start gap-3">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "h-6 w-6 rounded-full flex items-center justify-center border-2 shrink-0 text-[10px]",
                  isDone
                    ? "bg-emerald-500 border-emerald-500 text-white"
                    : isCurrent
                    ? "bg-white border-[#1A56DB] text-[#1A56DB]"
                    : "bg-white border-slate-200 text-slate-300"
                )}
              >
                {isDone ? (
                  <Check className="h-3 w-3" />
                ) : isCurrent ? (
                  <div className="h-2 w-2 rounded-full bg-[#1A56DB] animate-pulse" />
                ) : (
                  <div className="h-1.5 w-1.5 rounded-full bg-slate-300" />
                )}
              </div>
              {i < TIMELINE_STEPS.length - 1 && (
                <div className={cn("w-0.5 h-5", isDone ? "bg-emerald-300" : "bg-slate-200")} />
              )}
            </div>

            <div className="pb-1 pt-0.5">
              <p
                className={cn(
                  "text-xs font-semibold leading-tight",
                  isDone
                    ? "text-emerald-700"
                    : isCurrent
                    ? "text-[#1A56DB]"
                    : "text-slate-400"
                )}
              >
                {step.label}
              </p>
              {isDone && i === 0 && createdAt && (
                <p className="text-[10px] text-slate-400 font-medium">{formatDate(createdAt)}</p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function DocumentDetailClient({ envelope }: { envelope: any }) {
  const router = useRouter()
  const [title, setTitle] = useState(envelope.title)
  const [editingTitle, setEditingTitle] = useState(false)
  const [confirmState, setConfirmState] = useState<{
    open: boolean
    title: string
    description: string
    action: () => void
    destructive: boolean
  }>({ open: false, title: "", description: "", action: () => {}, destructive: false })

  const isDraft = envelope.status === "DRAFT"
  const isSent = ["SENT", "DELIVERED", "VIEWED", "PARTIALLY_SIGNED"].includes(envelope.status)
  const isCompleted = envelope.status === "COMPLETED"

  const openConfirm = (
    title: string,
    description: string,
    action: () => void,
    destructive = false
  ) => setConfirmState({ open: true, title, description, action, destructive })

  const handleCancelEnvelope = () =>
    openConfirm(
      "Cancel envelope",
      "This will prevent any remaining signers from signing. Are you sure?",
      async () => {
        await fetch(`/api/envelopes/${envelope.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "CANCELLED" }),
        })
        router.refresh()
      },
      true
    )

  const handleDelete = () =>
    openConfirm(
      "Delete draft",
      "Permanently delete this draft? This cannot be undone.",
      async () => {
        await fetch(`/api/envelopes/${envelope.id}`, { method: "DELETE" })
        router.push("/dashboard/documents")
      },
      true
    )

  const firstDocument = envelope.documents?.[0]

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Link
        href="/dashboard/documents"
        className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-[#1A56DB] transition-colors"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
        Back to Documents
      </Link>

      {/* Two-Column Structured Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left Column: Document Preview (3 cols) */}
        <div className="lg:col-span-3 space-y-4">
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-2 min-w-0">
                <div className="h-7 w-7 rounded bg-blue-50 text-[#1A56DB] flex items-center justify-center shrink-0">
                  <FileText className="h-4 w-4" />
                </div>
                <span className="text-xs font-bold text-slate-900 truncate">
                  {firstDocument?.filename ?? "Attached Agreement Document"}
                </span>
              </div>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-slate-200/60 text-slate-600">
                PDF Document
              </span>
            </div>

            {/* Document Viewer Box */}
            <div className="flex flex-col items-center justify-center bg-slate-100/70 p-12 min-h-[460px]">
              <div className="bg-white p-8 rounded-xl shadow-lg border border-slate-200 max-w-sm w-full text-center space-y-4">
                <div className="h-16 w-16 bg-blue-50 text-[#1A56DB] rounded-2xl flex items-center justify-center mx-auto shadow-inner">
                  <FileText className="h-8 w-8" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 truncate">
                    {envelope.title}
                  </h4>
                  <p className="text-xs text-slate-500 mt-1">
                    {firstDocument?.filename || "document.pdf"}
                  </p>
                </div>
                <div className="pt-2 border-t border-slate-100 flex items-center justify-center gap-2 text-xs font-semibold text-emerald-600">
                  <ShieldCheck className="h-4 w-4" /> 256-bit Secure Encrypted Document
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Information & Actions Panel (2 cols) */}
        <div className="lg:col-span-2 space-y-4">
          {/* Header Card */}
          <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-2xs space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <h1 className="text-base font-bold text-slate-900 leading-snug">
                  {envelope.title}
                </h1>
                <p className="text-[11px] text-slate-400 font-medium">
                  ID: <span className="font-mono text-slate-600">{envelope.id.slice(0, 18)}...</span>
                </p>
              </div>
              <StatusBadge status={envelope.status as StatusType} />
            </div>

            <div className="pt-3 border-t border-slate-100">
              <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">
                Signing Progress
              </h3>
              <StatusTimeline status={envelope.status} createdAt={envelope.createdAt} />
            </div>
          </div>

          {/* Signers Panel */}
          <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-2xs">
            <h3 className="text-xs font-bold text-slate-900 mb-3 flex items-center justify-between">
              <span>Recipients / Signers</span>
              <span className="text-[11px] text-slate-400 font-normal">
                {envelope.signers?.length || 0} total
              </span>
            </h3>
            <div className="space-y-2.5">
              {envelope.signers?.map((signer: any) => (
                <div key={signer.id} className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-200/60">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="h-7 w-7 rounded-full bg-[#1A56DB]/10 text-[#1A56DB] text-xs font-bold flex items-center justify-center shrink-0">
                      {getInitials(signer.name || signer.email)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900 truncate">
                        {signer.name || signer.email}
                      </p>
                      <p className="text-[10px] text-slate-400 truncate">{signer.email}</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                    {signer.status || "Pending"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Actions Panel */}
          <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-2xs space-y-2">
            <h3 className="text-xs font-bold text-slate-900 mb-2">Actions</h3>

            {isCompleted && (
              <Button className="w-full h-8 text-xs font-semibold bg-[#1A56DB] hover:bg-blue-700 text-white">
                <Download className="h-3.5 w-3.5 mr-1.5" /> Download Signed PDF
              </Button>
            )}

            {isSent && (
              <Button variant="outline" className="w-full h-8 text-xs font-semibold text-slate-700">
                <Bell className="h-3.5 w-3.5 mr-1.5" /> Send Email Reminder
              </Button>
            )}

            {isSent && (
              <Button
                variant="outline"
                className="w-full h-8 text-xs font-semibold text-rose-600 border-rose-200 hover:bg-rose-50"
                onClick={handleCancelEnvelope}
              >
                <XCircle className="h-3.5 w-3.5 mr-1.5" /> Cancel Request
              </Button>
            )}

            {isDraft && (
              <Button
                variant="destructive"
                className="w-full h-8 text-xs font-semibold"
                onClick={handleDelete}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Delete Draft
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Audit Log Trail */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-[#1A56DB]" />
            <h2 className="text-xs font-bold text-slate-900">Audit Log & Compliance Trail</h2>
          </div>
          <span className="text-[11px] font-semibold text-slate-500">Tamper-evident Certificate</span>
        </div>

        <div className="divide-y divide-slate-100 text-xs">
          {envelope.auditEvents?.length === 0 ? (
            <div className="p-6 text-center text-slate-400">No events logged yet.</div>
          ) : (
            envelope.auditEvents?.map((event: any) => (
              <div key={event.id} className="flex items-center justify-between px-5 py-3 hover:bg-slate-50">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                    {event.event}
                  </span>
                  <span className="font-medium text-slate-800">{event.actor || "System"}</span>
                </div>
                <span className="text-[11px] text-slate-400 font-medium">
                  {event.createdAt ? formatRelativeDate(new Date(event.createdAt)) : ""}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmState.open}
        onOpenChange={(open) => setConfirmState((s) => ({ ...s, open }))}
        title={confirmState.title}
        description={confirmState.description}
        confirmLabel="Confirm"
        onConfirm={confirmState.action}
        destructive={confirmState.destructive}
      />
    </div>
  )
}
