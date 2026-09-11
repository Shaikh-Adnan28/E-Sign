"use client"

import Link from "next/link"
import { Plus, Upload, FileSignature, Send, CheckCircle2, Sparkles, ShieldCheck, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"

export function DashboardEmptyState() {
  const steps = [
    {
      step: "01",
      title: "Upload document",
      desc: "Drag and drop any PDF agreement or contract.",
      icon: Upload,
    },
    {
      step: "02",
      title: "Prepare fields",
      desc: "Add signature, date, initials, and text fields.",
      icon: FileSignature,
    },
    {
      step: "03",
      title: "Send to signers",
      desc: "Deliver secure signature link via email.",
      icon: Send,
    },
    {
      step: "04",
      title: "Get legally signed",
      desc: "Track status in real-time and download audit logs.",
      icon: CheckCircle2,
    },
  ]

  return (
    <div className="space-y-8">
      {/* Onboarding Main Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-900 via-[#1A56DB] to-blue-700 text-white p-8 sm:p-10 shadow-xl shadow-blue-500/10">
        {/* Subtle background graphics */}
        <div className="absolute -right-12 -bottom-12 w-64 h-64 rounded-full bg-white/5 blur-2xl pointer-events-none" />
        <div className="absolute right-20 top-6 w-32 h-32 rounded-full bg-blue-400/20 blur-xl pointer-events-none" />

        <div className="relative z-10 max-w-2xl space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-blue-100 text-xs font-semibold border border-white/15">
            <Sparkles className="h-3.5 w-3.5 text-blue-200" /> Welcome to ESign
          </div>

          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white leading-tight">
            Sign documents. Without the paperwork.
          </h1>

          <p className="text-sm sm:text-base text-blue-100/90 leading-relaxed font-normal">
            Create, send, and collect legally binding electronic signatures in minutes. Fast, compliant, and beautifully simple.
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-4">
            <Button
              asChild
              size="lg"
              className="bg-white text-[#1A56DB] hover:bg-blue-50 font-semibold shadow-md text-sm h-11 px-6 rounded-xl transition-all"
            >
              <Link href="/dashboard/send" className="inline-flex items-center justify-center gap-2 whitespace-nowrap">
                <Plus className="h-4 w-4 shrink-0 text-[#1A56DB]" />
                <span>Send your first document</span>
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="border-white/30 text-white hover:bg-white/10 hover:text-white bg-transparent text-sm h-11 px-5"
            >
              <Link href="/dashboard/templates">
                Explore templates
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* 4-Step "How ESign works" Section */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-6 sm:p-8 shadow-2xs">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-base font-bold text-slate-900">How ESign works</h2>
            <p className="text-xs text-slate-500 mt-0.5">Four simple steps to get your first document signed</p>
          </div>
          <div className="hidden sm:flex items-center gap-3 text-xs text-slate-400 font-medium">
            <span className="flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5 text-emerald-500" /> ESIGN & eIDAS Compliant</span>
            <span className="flex items-center gap-1"><Zap className="h-3.5 w-3.5 text-amber-500" /> Bank-grade 256-bit encryption</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {steps.map((item) => {
            const Icon = item.icon
            return (
              <div
                key={item.step}
                className="relative p-5 rounded-xl bg-slate-50/70 border border-slate-200/60 flex flex-col justify-between hover:border-slate-300 transition-colors"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="h-9 w-9 rounded-lg bg-blue-50 text-[#1A56DB] flex items-center justify-center font-bold text-sm">
                      <Icon className="h-4.5 w-4.5" />
                    </div>
                    <span className="text-xs font-bold text-slate-300 tracking-wider">
                      STEP {item.step}
                    </span>
                  </div>
                  <h3 className="text-xs font-bold text-slate-900 mb-1">
                    {item.title}
                  </h3>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    {item.desc}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
