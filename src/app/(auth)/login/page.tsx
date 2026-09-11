"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { signIn } from "next-auth/react"
import { FileSignature, Mail, Lock, Eye, EyeOff, Loader2, CheckCircle2, ShieldCheck, FileCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { GoogleButton, OrDivider } from "@/components/shared/google-button"
import { cn } from "@/lib/utils"

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
})

type LoginForm = z.infer<typeof loginSchema>

export default function LoginPage() {
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const [googleError, setGoogleError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (data: LoginForm) => {
    setAuthError(null)

    const result = await signIn("credentials", {
      email: data.email,
      password: data.password,
      redirect: false,
    })

    if (result?.error) {
      setAuthError("Invalid email or password")
      return
    }

    router.push("/dashboard")
    router.refresh()
  }

  return (
    <div className="min-h-screen flex w-full bg-slate-50">
      {/* LEFT SIDE: Brand Showcase Panel (Desktop) */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-slate-900 via-[#1A56DB] to-blue-900 text-white p-12 flex-col justify-between relative overflow-hidden">
        {/* Subtle decorative glow elements */}
        <div className="absolute top-1/4 -left-20 w-80 h-80 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-10 right-10 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Brand Logo */}
        <div className="relative z-10 flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-white text-[#1A56DB] flex items-center justify-center shadow-lg shadow-blue-900/30">
            <FileSignature className="h-5 w-5" />
          </div>
          <span className="text-2xl font-bold tracking-tight text-white">ESign</span>
        </div>

        {/* Middle Content Hero */}
        <div className="relative z-10 space-y-6 max-w-lg my-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-blue-200 text-xs font-semibold backdrop-blur-md border border-white/10">
            <ShieldCheck className="h-3.5 w-3.5" /> Trusted by 50,000+ Professionals
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight leading-tight text-white">
            Sign documents. <br />
            Without the paperwork.
          </h1>

          <p className="text-sm text-blue-100/90 leading-relaxed font-normal">
            Create, send, and legally sign agreements in minutes. Real-time audit trails, automated reminders, and bank-grade encryption built for modern teams.
          </p>

          <div className="space-y-3 pt-2">
            {[
              "Legally binding ESIGN & eIDAS compliance",
              "Real-time signer status tracking & instant alerts",
              "Automated document reminders & tamper-proof audit log",
            ].map((feature, i) => (
              <div key={i} className="flex items-center gap-2.5 text-xs text-blue-100 font-medium">
                <CheckCircle2 className="h-4 w-4 text-blue-300 shrink-0" />
                <span>{feature}</span>
              </div>
            ))}
          </div>

          {/* Abstract Signature Preview Mockup */}
          <div className="pt-6">
            <div className="p-4 rounded-xl bg-white/10 backdrop-blur-md border border-white/15 shadow-2xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-emerald-400/20 text-emerald-300 flex items-center justify-center font-bold">
                  <FileCheck className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-white">Executive_Offer_Letter.pdf</p>
                  <p className="text-[10px] text-blue-200">2 of 2 signers completed</p>
                </div>
              </div>
              <span className="text-[10px] font-bold px-2 py-1 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                COMPLETED
              </span>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="relative z-10 text-xs text-blue-200/60 flex items-center justify-between">
          <p>© 2026 ESign Inc. All rights reserved.</p>
          <p>Bank-grade 256-bit SSL</p>
        </div>
      </div>

      {/* RIGHT SIDE: Auth Card */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200/80 shadow-sm p-8 sm:p-10 space-y-6">
          {/* Mobile Logo */}
          <div className="flex lg:hidden items-center gap-2 justify-center mb-2">
            <div className="h-9 w-9 rounded-xl bg-[#1A56DB] flex items-center justify-center text-white">
              <FileSignature className="h-5 w-5" />
            </div>
            <span className="text-xl font-bold text-slate-900">ESign</span>
          </div>

          {/* Header */}
          <div className="text-center sm:text-left space-y-1">
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Welcome back</h2>
            <p className="text-xs text-slate-500 font-medium">
              Sign in to manage and send your documents
            </p>
          </div>

          {/* Google Sign In */}
          <div className="space-y-4">
            <GoogleButton
              label="Continue with Google"
              callbackUrl="/dashboard"
              onError={(msg) => setGoogleError(msg)}
            />
            {googleError && (
              <div className="rounded-lg bg-rose-50 border border-rose-200 p-3">
                <p className="text-xs text-rose-700">{googleError}</p>
              </div>
            )}
            <OrDivider />
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
            {/* Email */}
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-semibold text-slate-700">Email address</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  id="email"
                  type="email"
                  placeholder="name@company.com"
                  autoComplete="email"
                  className={cn("pl-9 h-10 text-xs bg-slate-50/50 border-slate-200 focus:bg-white focus:border-[#1A56DB]", errors.email && "border-rose-500 focus-visible:ring-rose-500")}
                  {...register("email")}
                />
              </div>
              {errors.email && (
                <p className="text-[11px] text-rose-600 font-medium">{errors.email.message}</p>
              )}
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-xs font-semibold text-slate-700">Password</Label>
                <Link
                  href="/forgot-password"
                  className="text-xs text-[#1A56DB] hover:underline font-semibold"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className={cn("pl-9 pr-9 h-10 text-xs bg-slate-50/50 border-slate-200 focus:bg-white focus:border-[#1A56DB]", errors.password && "border-rose-500 focus-visible:ring-rose-500")}
                  {...register("password")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-[11px] text-rose-600 font-medium">{errors.password.message}</p>
              )}
            </div>

            {/* Auth error */}
            {authError && (
              <div className="rounded-lg bg-rose-50 border border-rose-200 p-3">
                <p className="text-xs text-rose-700 font-medium">{authError}</p>
              </div>
            )}

            {/* Submit CTA */}
            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-10 bg-[#1A56DB] hover:bg-blue-700 text-white font-semibold text-xs shadow-sm shadow-blue-500/20"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                "Sign in to Dashboard"
              )}
            </Button>
          </form>

          {/* Footer link */}
          <div className="pt-2 border-t border-slate-100 text-center text-xs text-slate-500">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="text-[#1A56DB] hover:underline font-bold">
              Sign up for free
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
