"use client"

import Link from "next/link"
import { FileText, MoreVertical, Eye, Download, Send, ArrowRight, FileCheck } from "lucide-react"
import { StatusBadge, StatusType } from "@/components/documents/status-badge"
import { formatRelativeDate, getInitials } from "@/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"

export interface DashboardEnvelopeItem {
  id: string
  title: string
  status: string
  createdAt: Date | string | null
  signers: Array<{
    name?: string | null
    email: string
    status?: string | null
  }>
}

interface RecentDocsProps {
  envelopes: DashboardEnvelopeItem[]
}

export function RecentDocs({ envelopes }: RecentDocsProps) {
  return (
    <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden">
      {/* Table Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/50">
        <div className="flex items-center gap-2">
          <FileCheck className="h-4 w-4 text-[#1A56DB]" />
          <h2 className="text-sm font-semibold text-slate-900">Recent documents</h2>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-200/70 text-slate-600">
            {envelopes.length}
          </span>
        </div>
        <Link
          href="/dashboard/documents"
          className="text-xs font-semibold text-[#1A56DB] hover:text-blue-700 flex items-center gap-1 group transition-colors"
        >
          View all documents
          <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>

      {/* Document List */}
      <div className="divide-y divide-slate-100">
        {envelopes.map((doc) => {
          const formattedDate = doc.createdAt ? formatRelativeDate(new Date(doc.createdAt)) : "Recently"

          return (
            <div
              key={doc.id}
              className="group flex items-center justify-between px-5 py-3.5 hover:bg-slate-50/80 transition-colors"
            >
              {/* Document Icon & Details */}
              <Link
                href={`/dashboard/documents/${doc.id}`}
                className="flex items-center gap-3.5 min-w-0 flex-1 pr-4"
              >
                {/* PDF/Document Icon Box */}
                <div className="h-9 w-9 rounded-lg bg-blue-50/80 border border-blue-100 flex items-center justify-center text-[#1A56DB] shrink-0 group-hover:scale-105 transition-transform">
                  <FileText className="h-4.5 w-4.5" />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-slate-900 truncate group-hover:text-[#1A56DB] transition-colors">
                    {doc.title}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[11px] text-slate-400 font-medium">
                      {doc.signers.length} {doc.signers.length === 1 ? "signer" : "signers"}
                    </span>
                    <span className="text-slate-300">•</span>
                    <span className="text-[11px] text-slate-400">
                      Updated {formattedDate}
                    </span>
                  </div>
                </div>
              </Link>

              {/* Signer Avatars */}
              <div className="hidden sm:flex items-center -space-x-1.5 mr-6 shrink-0">
                {doc.signers.slice(0, 3).map((s, i) => (
                  <div
                    key={i}
                    title={`${s.name || s.email} (${s.status || "Pending"})`}
                    className="h-6 w-6 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold flex items-center justify-center border-2 border-white ring-1 ring-slate-200/60 shrink-0"
                  >
                    {getInitials(s.name || s.email)}
                  </div>
                ))}
                {doc.signers.length > 3 && (
                  <div className="h-6 w-6 rounded-full bg-slate-200 text-slate-600 text-[9px] font-bold flex items-center justify-center border-2 border-white">
                    +{doc.signers.length - 3}
                  </div>
                )}
              </div>

              {/* Status Badge */}
              <div className="shrink-0 mr-3">
                <StatusBadge status={doc.status as StatusType} />
              </div>

              {/* Row Action Menu */}
              <div className="shrink-0">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-slate-400 hover:text-slate-600 hover:bg-slate-100 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <MoreVertical className="h-3.5 w-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-40">
                    <DropdownMenuItem asChild>
                      <Link href={`/dashboard/documents/${doc.id}`} className="cursor-pointer text-xs">
                        <Eye className="mr-2 h-3.5 w-3.5" /> View details
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem className="cursor-pointer text-xs">
                      <Send className="mr-2 h-3.5 w-3.5" /> Send reminder
                    </DropdownMenuItem>
                    <DropdownMenuItem className="cursor-pointer text-xs">
                      <Download className="mr-2 h-3.5 w-3.5" /> Download PDF
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}