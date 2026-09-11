import { cn } from "@/lib/utils"

export type StatusType =
  | "DRAFT"
  | "SENT"
  | "DELIVERED"
  | "VIEWED"
  | "PARTIALLY_SIGNED"
  | "COMPLETED"
  | "DECLINED"
  | "EXPIRED"
  | "CANCELLED"

interface StatusBadgeProps {
  status: StatusType
  className?: string
}

const statusConfig: Record<
  StatusType,
  { label: string; badgeStyle: string; dotStyle: string }
> = {
  DRAFT: {
    label: "Draft",
    badgeStyle: "bg-slate-100 text-slate-700 border-slate-200",
    dotStyle: "bg-slate-400",
  },
  SENT: {
    label: "Sent",
    badgeStyle: "bg-blue-50 text-blue-700 border-blue-200/80",
    dotStyle: "bg-blue-500",
  },
  DELIVERED: {
    label: "Delivered",
    badgeStyle: "bg-sky-50 text-sky-700 border-sky-200/80",
    dotStyle: "bg-sky-500",
  },
  VIEWED: {
    label: "Viewed",
    badgeStyle: "bg-indigo-50 text-indigo-700 border-indigo-200/80",
    dotStyle: "bg-indigo-500",
  },
  PARTIALLY_SIGNED: {
    label: "In Progress",
    badgeStyle: "bg-amber-50 text-amber-700 border-amber-200/80",
    dotStyle: "bg-amber-500 animate-pulse",
  },
  COMPLETED: {
    label: "Completed",
    badgeStyle: "bg-emerald-50 text-emerald-700 border-emerald-200/80",
    dotStyle: "bg-emerald-500",
  },
  DECLINED: {
    label: "Declined",
    badgeStyle: "bg-rose-50 text-rose-700 border-rose-200/80",
    dotStyle: "bg-rose-500",
  },
  EXPIRED: {
    label: "Expired",
    badgeStyle: "bg-orange-50 text-orange-700 border-orange-200/80",
    dotStyle: "bg-orange-400",
  },
  CANCELLED: {
    label: "Cancelled",
    badgeStyle: "bg-slate-100 text-slate-500 border-slate-200",
    dotStyle: "bg-slate-400",
  },
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status] || statusConfig.DRAFT

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border transition-all",
        config.badgeStyle,
        className
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", config.dotStyle)} />
      {config.label}
    </span>
  )
}