import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { envelopes, signers, auditEvents } from "@/lib/db/schema"
import { eq, and, inArray, count, gte, lt, desc } from "drizzle-orm"
import Link from "next/link"
import { Plus, Copy, Clock, CheckCircle2, AlertTriangle, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { StatsCards, DashboardStatsData } from "@/components/dashboard/stats-cards"
import { RecentDocs, DashboardEnvelopeItem } from "@/components/dashboard/recent-docs"
import { ActivityFeed, DashboardActivityItem } from "@/components/dashboard/activity-feed"
import { DashboardEmptyState } from "@/components/dashboard/dashboard-empty"
import { MOCK_STATS, MOCK_ENVELOPES, MOCK_ACTIVITIES } from "@/lib/mock-dashboard-data"
import { format } from "date-fns"

async function getDashboardData(userId: string) {
  try {
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)

    // Parallel db queries
    const [pendingRes, sentThisMonthRes, completedRes, totalSentRes] = await Promise.all([
      db
        .select({ count: count() })
        .from(envelopes)
        .where(
          and(
            eq(envelopes.ownerId, userId),
            inArray(envelopes.status, ["SENT", "DELIVERED", "VIEWED", "PARTIALLY_SIGNED"])
          )
        ),
      db
        .select({ count: count() })
        .from(envelopes)
        .where(
          and(
            eq(envelopes.ownerId, userId),
            gte(envelopes.createdAt, startOfMonth),
            lt(envelopes.createdAt, startOfNextMonth)
          )
        ),
      db
        .select({ count: count() })
        .from(envelopes)
        .where(and(eq(envelopes.ownerId, userId), eq(envelopes.status, "COMPLETED"))),
      db
        .select({ count: count() })
        .from(envelopes)
        .where(eq(envelopes.ownerId, userId)),
    ])

    const totalCount = Number(totalSentRes[0]?.count ?? 0)
    const completedCount = Number(completedRes[0]?.count ?? 0)
    const completionRate = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

    const stats: DashboardStatsData = {
      pending: Number(pendingRes[0]?.count ?? 0),
      sentThisMonth: Number(sentThisMonthRes[0]?.count ?? 0),
      completed: completedCount,
      completionRate,
    }

    // Fetch recent envelopes
    const rawEnvelopes = await db
      .select({
        id: envelopes.id,
        title: envelopes.title,
        status: envelopes.status,
        createdAt: envelopes.createdAt,
      })
      .from(envelopes)
      .where(eq(envelopes.ownerId, userId))
      .orderBy(desc(envelopes.createdAt))
      .limit(6)

    const envelopeIds = rawEnvelopes.map((e) => e.id)
    const signerRows =
      envelopeIds.length > 0
        ? await db
            .select({
              envelopeId: signers.envelopeId,
              name: signers.name,
              email: signers.email,
              status: signers.status,
            })
            .from(signers)
            .where(inArray(signers.envelopeId, envelopeIds))
        : []

    const signersMap = signerRows.reduce<Record<string, typeof signerRows>>((acc, s) => {
      if (!acc[s.envelopeId]) acc[s.envelopeId] = []
      acc[s.envelopeId].push(s)
      return acc
    }, {})

    const recentEnvelopes: DashboardEnvelopeItem[] = rawEnvelopes.map((env) => ({
      id: env.id,
      title: env.title,
      status: env.status,
      createdAt: env.createdAt,
      signers: signersMap[env.id] ?? [],
    }))

    // Fetch activity
    let recentActivities: DashboardActivityItem[] = []
    if (envelopeIds.length > 0) {
      const titleMap = Object.fromEntries(rawEnvelopes.map((e) => [e.id, e.title]))
      const events = await db
        .select()
        .from(auditEvents)
        .where(inArray(auditEvents.envelopeId, envelopeIds))
        .orderBy(desc(auditEvents.createdAt))
        .limit(8)

      recentActivities = events.map((e) => ({
        id: e.id,
        envelopeId: e.envelopeId,
        event: e.event,
        actor: e.actor,
        envelopeTitle: (e.envelopeId && titleMap[e.envelopeId]) ?? "Document",
        createdAt: e.createdAt,
      }))
    }

    // FALLBACK TO DEVELOPMENT MOCK DATA IF ZERO RECORDS (for rich UI preview)
    if (totalCount === 0 && process.env.NODE_ENV !== "production") {
      return {
        stats: MOCK_STATS,
        recentEnvelopes: MOCK_ENVELOPES,
        recentActivities: MOCK_ACTIVITIES,
        isMock: true,
        hasRealDocs: false,
      }
    }

    return {
      stats,
      recentEnvelopes,
      recentActivities,
      isMock: false,
      hasRealDocs: totalCount > 0,
    }
  } catch (error) {
    console.error("[DASHBOARD_DATA_ERROR]", error)
    return {
      error: true,
      stats: MOCK_STATS,
      recentEnvelopes: MOCK_ENVELOPES,
      recentActivities: MOCK_ACTIVITIES,
      isMock: true,
      hasRealDocs: false,
    }
  }
}

function getGreetingTime(): string {
  const hour = new Date().getHours()
  if (hour < 12) return "Good morning"
  if (hour < 17) return "Good afternoon"
  return "Good evening"
}

export default async function DashboardPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const userId = session.user.id
  const userName = session.user.name || session.user.email?.split("@")[0] || "there"
  const greeting = getGreetingTime()
  const currentDateFormatted = format(new Date(), "EEEE, MMMM d, yyyy")

  const data = await getDashboardData(userId)

  if (data.error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50/50 p-8 text-center max-w-lg mx-auto my-12 space-y-4">
        <div className="h-12 w-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <h2 className="text-lg font-bold text-slate-900">Unable to load your dashboard</h2>
        <p className="text-xs text-slate-500">
          We encountered an issue fetching your latest document activity. Please check your database connection or try again.
        </p>
        <Button asChild size="sm" className="bg-[#1A56DB] hover:bg-blue-700 text-white">
          <Link href="/dashboard">Try again</Link>
        </Button>
      </div>
    )
  }

  const { stats, recentEnvelopes, recentActivities, isMock } = data

  // Filter pending documents that require urgent attention
  const pendingDocs = recentEnvelopes.filter((env) =>
    ["SENT", "DELIVERED", "VIEWED", "PARTIALLY_SIGNED"].includes(env.status)
  )

  return (
    <div className="space-y-6">
      {/* Dev Mock Data Indicator Pill (Non-intrusive) */}
      {isMock && (
        <div className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-blue-50/90 border border-blue-200 text-xs text-blue-800">
          <span className="flex items-center gap-1.5 font-medium">
            <Sparkles className="h-3.5 w-3.5 text-[#1A56DB]" />
            Development UI Preview Mode — Showing sample data until you send your first real document.
          </span>
          <Link
            href="/dashboard/send"
            className="font-bold underline hover:text-blue-900 text-[11px]"
          >
            Create real document →
          </Link>
        </div>
      )}

      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/60">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            {greeting}, {userName} 👋
          </h1>
          <p className="text-xs text-slate-500 mt-0.5 font-medium flex items-center gap-2">
            <span>Here&apos;s what&apos;s happening with your documents today.</span>
            <span className="text-slate-300">•</span>
            <span className="text-slate-400">{currentDateFormatted}</span>
          </p>
        </div>

        <Button
          asChild
          className="bg-[#1A56DB] hover:bg-blue-700 text-white font-semibold text-xs h-9 px-4 shadow-sm shadow-blue-500/20 shrink-0 rounded-xl"
        >
          <Link href="/dashboard/send" className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap">
            <Plus className="h-3.5 w-3.5 shrink-0" />
            <span>Send document</span>
          </Link>
        </Button>
      </div>

      {/* Quick Action Area */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Link
          href="/dashboard/send"
          className="group flex items-center gap-3 p-3.5 rounded-xl bg-white border border-slate-200/80 shadow-2xs hover:shadow-md hover:border-blue-200 hover:bg-blue-50/30 transition-all"
        >
          <div className="h-9 w-9 rounded-lg bg-blue-50 text-[#1A56DB] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
            <Plus className="h-4.5 w-4.5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-slate-900 truncate group-hover:text-[#1A56DB]">
              Send document
            </p>
            <p className="text-[10px] text-slate-400 truncate">Request signatures</p>
          </div>
        </Link>

        <Link
          href="/dashboard/templates"
          className="group flex items-center gap-3 p-3.5 rounded-xl bg-white border border-slate-200/80 shadow-2xs hover:shadow-md hover:border-blue-200 hover:bg-blue-50/30 transition-all"
        >
          <div className="h-9 w-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
            <Copy className="h-4.5 w-4.5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-slate-900 truncate group-hover:text-indigo-600">
              Create template
            </p>
            <p className="text-[10px] text-slate-400 truncate">Reusable formats</p>
          </div>
        </Link>

        <Link
          href="/dashboard/documents?status=WAITING"
          className="group flex items-center gap-3 p-3.5 rounded-xl bg-white border border-slate-200/80 shadow-2xs hover:shadow-md hover:border-amber-200 hover:bg-amber-50/30 transition-all"
        >
          <div className="h-9 w-9 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
            <Clock className="h-4.5 w-4.5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-slate-900 truncate group-hover:text-amber-600">
              View pending
            </p>
            <p className="text-[10px] text-slate-400 truncate">{stats.pending} waiting</p>
          </div>
        </Link>

        <Link
          href="/dashboard/documents?status=COMPLETED"
          className="group flex items-center gap-3 p-3.5 rounded-xl bg-white border border-slate-200/80 shadow-2xs hover:shadow-md hover:border-emerald-200 hover:bg-emerald-50/30 transition-all"
        >
          <div className="h-9 w-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
            <CheckCircle2 className="h-4.5 w-4.5" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-bold text-slate-900 truncate group-hover:text-emerald-600">
              View completed
            </p>
            <p className="text-[10px] text-slate-400 truncate">{stats.completed} signed</p>
          </div>
        </Link>
      </div>

      {/* Statistics Cards */}
      <StatsCards stats={stats} />

      {/* "Needs Your Attention" Section (If pending items exist) */}
      {pendingDocs.length > 0 && (
        <div className="bg-amber-50/60 rounded-xl border border-amber-200/80 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-2xs">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-9 w-9 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 font-bold">
              <Clock className="h-4.5 w-4.5 text-amber-700" />
            </div>
            <div className="min-w-0">
              <span className="text-xs font-bold text-amber-900 block">
                Needs your attention
              </span>
              <p className="text-xs text-amber-800/80 truncate">
                {pendingDocs[0].title} is waiting for signers (
                {pendingDocs[0].signers[0]?.name || pendingDocs[0].signers[0]?.email || "Signer"})
              </p>
            </div>
          </div>
          <Button
            asChild
            size="sm"
            className="bg-amber-700 hover:bg-amber-800 text-white font-semibold text-xs h-8 px-3 shrink-0"
          >
            <Link href={`/dashboard/documents/${pendingDocs[0].id}`}>
              View details
            </Link>
          </Button>
        </div>
      )}

      {/* Main Content Grid (65% / 35%) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-2">
          <RecentDocs envelopes={recentEnvelopes} />
        </div>
        <div className="lg:col-span-1 h-full">
          <ActivityFeed activities={recentActivities} />
        </div>
      </div>

      {/* Onboarding Empty Section if user has very few documents */}
      {recentEnvelopes.length <= 1 && (
        <div className="pt-4">
          <DashboardEmptyState />
        </div>
      )}
    </div>
  )
}
