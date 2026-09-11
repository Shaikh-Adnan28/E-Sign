"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import { Loader2 } from "lucide-react"

interface GoogleButtonProps {
  label?: string
  callbackUrl?: string
  onError?: (msg: string) => void
}

// Official Google G SVG — taken from Google's brand guidelines
function GoogleLogo() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 48 48"
      aria-hidden="true"
      className="h-5 w-5 shrink-0"
    >
      <path
        fill="#EA4335"
        d="M24 9.5c3.14 0 5.95 1.08 8.17 2.86l6.08-6.08C34.46 3.09 29.5 1 24 1 14.82 1 7.07 6.48 3.64 14.22l7.08 5.5C12.43 13.64 17.73 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.5 24.5c0-1.64-.15-3.22-.42-4.75H24v9h12.7c-.55 2.97-2.18 5.49-4.65 7.19l7.19 5.59C43.46 37.6 46.5 31.5 46.5 24.5z"
      />
      <path
        fill="#FBBC05"
        d="M10.72 28.28A14.6 14.6 0 0 1 9.5 24c0-1.49.26-2.93.72-4.28l-7.08-5.5A23.94 23.94 0 0 0 0 24c0 3.87.93 7.53 2.57 10.77l8.15-6.49z"
      />
      <path
        fill="#34A853"
        d="M24 47c5.5 0 10.12-1.82 13.49-4.93l-7.19-5.59C28.56 38.1 26.38 39 24 39c-6.27 0-11.57-4.14-13.28-9.72l-8.15 6.49C6.07 43.52 14.46 47 24 47z"
      />
    </svg>
  )
}

export function GoogleButton({
  label = "Continue with Google",
  callbackUrl = "/dashboard",
  onError,
}: GoogleButtonProps) {
  const [loading, setLoading] = useState(false)

  const handleClick = async () => {
    if (loading) return
    setLoading(true)

    try {
      // redirect: true → NextAuth redirects to Google and back automatically.
      // On error NextAuth redirects to the error page; we don't get a return value.
      await signIn("google", { callbackUrl })
      // If we reach here somehow (e.g. popup flow), reset loading
      setLoading(false)
    } catch {
      onError?.("Something went wrong. Please try again.")
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      aria-label="Continue with Google"
      className="
        w-full h-11 flex items-center justify-center gap-3
        bg-white border border-gray-200 rounded-lg
        text-sm font-medium text-gray-700
        hover:bg-gray-50 hover:border-gray-300
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300
        active:bg-gray-100
        transition-colors
        disabled:opacity-60 disabled:cursor-not-allowed
        shadow-sm
      "
    >
      {loading ? (
        <Loader2 className="h-5 w-5 animate-spin text-gray-500" />
      ) : (
        <GoogleLogo />
      )}
      <span>{loading ? "Redirecting to Google..." : label}</span>
    </button>
  )
}

// ── OR divider ────────────────────────────────────────────────────

export function OrDivider() {
  return (
    <div className="flex items-center gap-3" role="separator" aria-label="or">
      <div className="flex-1 h-px bg-gray-200" />
      <span className="text-xs font-medium text-gray-400 uppercase tracking-wide select-none">
        or
      </span>
      <div className="flex-1 h-px bg-gray-200" />
    </div>
  )
}
