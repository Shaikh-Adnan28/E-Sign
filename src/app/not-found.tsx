import Link from "next/link"
import { FileQuestion, ArrowLeft, LayoutDashboard } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-center">
      <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200/80 p-8 sm:p-10 shadow-sm space-y-6">
        {/* Document Graphic Icon */}
        <div className="relative mx-auto h-20 w-20 rounded-2xl bg-blue-50 text-[#1A56DB] flex items-center justify-center border border-blue-100 shadow-inner">
          <FileQuestion className="h-10 w-10" />
          <span className="absolute -top-2 -right-2 px-2 py-0.5 rounded-full bg-[#1A56DB] text-white font-mono text-[10px] font-bold">
            404
          </span>
        </div>

        {/* Text Details */}
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Page not found
          </h1>
          <p className="text-xs text-slate-500 leading-relaxed max-w-xs mx-auto">
            The page you&apos;re looking for doesn&apos;t exist or may have been moved.
          </p>
        </div>

        {/* Actions */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button
            asChild
            className="w-full sm:w-auto bg-[#1A56DB] hover:bg-blue-700 text-white font-semibold text-xs h-9 px-5 shadow-sm shadow-blue-500/20"
          >
            <Link href="/dashboard">
              <LayoutDashboard className="h-3.5 w-3.5 mr-1.5" />
              Go to dashboard
            </Link>
          </Button>

          <Button
            asChild
            variant="outline"
            className="w-full sm:w-auto border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold text-xs h-9 px-4"
          >
            <Link href="/dashboard">
              <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
              Go back
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
