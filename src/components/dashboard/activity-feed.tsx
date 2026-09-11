"use client"

import Link from "next/link"
import { Activity as ActivityIcon, ArrowRight } from "lucide-react"
import { formatRelativeDate, truncate } from "@/lib/utils"

export interface DashboardActivityItem {
  id: string
  envelopeId: string
  event: string
  actor: string | null
  envelopeTitle: string
  createdAt: Date | string | null
}

interface ActivityFeedProps {
  activities: DashboardActivityItem[]
}

function formatEventText(event: string, actor: string | null, title: string): string {
  const shortTitle = truncate(title, 26)
  switch (event) {
    case "document.sent":
      return `${actor || "You"} sent "${shortTitle}"`
    case "signer.viewed":
      return `${actor || "Someone"} viewed "${shortTitle}"`
    case "document.completed":
      return `"${shortTitle}" was fully completed & signed`
    case "document.declined":
      return `${actor || "Someone"} declined "${shortTitle}"`
    case "signer.signed":
      return `${actor || "Someone"} signed "${shortTitle}"`
    case "envelope.created":
      return `Created draft "${shortTitle}"`
    default:
      return `Activity on "${shortTitle}"`
  }
}

function eventDotColor(event: string): string {
  if (event.includes("completed")) return "bg-emerald-500 ring-emerald-100"
  if (event.includes("declined")) return "bg-rose-500 ring-rose-100"
  if (event.includes("viewed")) return "bg-indigo-500 ring-indigo-100"
  if (event.includes("signed")) return "bg-[#1A56DB] ring-blue-100"
  if (event.includes("sent")) return "bg-sky-500 ring-sky-100"
  return "bg-slate-400 ring-slate-100"
}

export function ActivityFeed({ activities }: ActivityFeedProps) {
  return (
    <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/50">
        <div className="flex items-center gap-2">
          <ActivityIcon className="h-4 w-4 text-[#1A56DB]" />
          <h2 className="text-sm font-semibold text-slate-900">Recent activity</h2>
        </div>
        <Link
          href="/dashboard/activity"
          className="text-xs font-semibold text-[#1A56DB] hover:text-blue-700 flex items-center gap-1 group transition-colors"
        >
          View all
          <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>

      {/* Activity Timeline List */}
      {activities.length === 0 ? (
        <div className="p-8 text-center text-xs text-slate-400">
          No activity recorded yet.
        </div>
      ) : (
        <div className="p-5 flex-1 space-y-4 overflow-y-auto">
          {activities.map((item) => {
            const timeAgo = item.createdAt ? formatRelativeDate(new Date(item.createdAt)) : "Just now"
            return (
              <div key={item.id} className="relative flex items-start gap-3 text-xs group">
                <div className="mt-1 shrink-0">
                  <div className={`h-2.5 w-2.5 rounded-full ring-4 ${eventDotColor(item.event)}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-800 leading-snug group-hover:text-slate-900 transition-colors">
                    {formatEventText(item.event, item.actor, item.envelopeTitle)}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5 font-medium">
                    {timeAgo}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}