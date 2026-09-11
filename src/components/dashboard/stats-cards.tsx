import { Clock, Send, CheckCircle2, TrendingUp, AlertCircle } from "lucide-react"

export interface DashboardStatsData {
  pending: number
  sentThisMonth: number
  completed: number
  completionRate: number
}

interface StatsCardsProps {
  stats: DashboardStatsData
}

export function StatsCards({ stats }: StatsCardsProps) {
  const cards = [
    {
      title: "Waiting for signature",
      value: stats.pending,
      subtext: stats.pending === 1 ? "1 document needs attention" : `${stats.pending} need attention`,
      icon: Clock,
      badge: stats.pending > 0 ? { label: "Action required", color: "bg-amber-50 text-amber-700 border-amber-200/60" } : undefined,
      iconBg: "bg-blue-50 text-[#1A56DB]",
    },
    {
      title: "Sent this month",
      value: stats.sentThisMonth,
      subtext: "Envelopes created & sent",
      icon: Send,
      badge: { label: "+12% MoM", color: "bg-emerald-50 text-emerald-700 border-emerald-200/60" },
      iconBg: "bg-sky-50 text-sky-600",
    },
    {
      title: "Completed",
      value: stats.completed,
      subtext: "Fully signed & archived",
      icon: CheckCircle2,
      badge: { label: "100% legal", color: "bg-emerald-50 text-emerald-700 border-emerald-200/60" },
      iconBg: "bg-emerald-50 text-emerald-600",
    },
    {
      title: "Completion rate",
      value: `${stats.completionRate}%`,
      subtext: "Of all sent documents",
      icon: TrendingUp,
      badge: { label: "+4% target", color: "bg-indigo-50 text-indigo-700 border-indigo-200/60" },
      iconBg: "bg-indigo-50 text-indigo-600",
    },
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => {
        const Icon = card.icon
        return (
          <div
            key={card.title}
            className="group bg-white rounded-xl border border-slate-200/80 p-5 shadow-2xs hover:shadow-md hover:border-slate-300 transition-all duration-200"
          >
            <div className="flex items-center justify-between mb-3">
              <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${card.iconBg} transition-transform group-hover:scale-105`}>
                <Icon className="h-4.5 w-4.5" />
              </div>
              {card.badge && (
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${card.badge.color}`}>
                  {card.badge.label}
                </span>
              )}
            </div>
            <div>
              <span className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 leading-tight">
                {card.value}
              </span>
              <p className="text-xs font-semibold text-slate-700 mt-1">
                {card.title}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {card.subtext}
              </p>
            </div>
          </div>
        )
      })}
    </div>
  )
}