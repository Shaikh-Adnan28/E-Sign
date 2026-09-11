"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { signIn } from "next-auth/react"
import { FileSignature, Mail, Lock, Eye, EyeOff, User, Loader2, CheckCircle2, ShieldCheck, FileCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { GoogleButton, OrDivider } from "@/components/shared/google-button"
import { cn } from "@/lib/utils"

const signupSchema = z
  .object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    email: z.string().email("Please enter a valid email address"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })

type SignupForm = z.infer<typeof signupSchema>

function getPasswordStrength(password: string): {
  score: number
  label: string
  color: string
} {
  if (!password) return { score: 0, label: "", color: "" }

  let score = 0
  if (password.length >= 8) score++
  if (password.length >= 12) score++
  if (/[A-Z]/.test(password)) score++
  if (/[0-9]/.test(password)) score++
  if (/[^A-Za-z0-9]/.test(password)) score++

  if (score <= 2) return { score, label: "Weak", color: "bg-rose-500" }
  if (score <= 3) return { score, label: "Fair", color: "bg-amber-500" }
  return { score, label: "Strong", color: "bg-emerald-500" }
}

export default function SignupPage() {
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [googleError, setGoogleError] = useState<string | null>(null)
  const [passwordValue, setPasswordValue] = useState("")

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignupForm>({
    resolver: zodResolver(signupSchema),
  })

  const strength = getPasswordStrength(passwordValue)

  const handleEmailBlur = async (email: string) => {
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return
    try {
      const res = await fetch(`/api/auth/check-email?email=${encodeURIComponent(email)}`)
      const data: { available: boolean } = await res.json()
      if (!data.available) {
        setEmailError("This email is already registered")
      } else {
        setEmailError(null)
      }
    } catch {
      // ignore check error
    }
  }

  const onSubmit = async (data: SignupForm) => {
    if (emailError) return
    setSubmitError(null)

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name,
          email: data.email,
          password: data.password,
        }),
      })

      const json: { error?: string } = await res.json()

      if (!res.ok) {
        setSubmitError(json.error ?? "Registration failed")
        return
      }

      const result = await signIn("credentials", {
        email: data.email,
        password: data.password,
        redirect: false,
      })

      if (result?.error) {
        setSubmitError("Account created but sign in failed. Please log in.")
        router.push("/login")
        return
      }

      router.push("/dashboard")
      router.refresh()
    } catch {
      setSubmitError("Something went wrong. Please try again.")
    }
  }

  const emailField = register("email")

  return (
    <div className="min-h-screen flex w-full bg-slate-50">
      {/* LEFT SIDE: Brand Showcase Panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-slate-900 via-[#1A56DB] to-blue-900 text-white p-12 flex-col justify-between relative overflow-hidden">
        <div className="absolute top-1/4 -left-20 w-80 h-80 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-10 right-10 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-white text-[#1A56DB] flex items-center justify-center shadow-lg shadow-blue-900/30">
            <FileSignature className="h-5 w-5" />
          </div>
          <span className="text-2xl font-bold tracking-tight text-white">ESign</span>
        </div>

        <div className="relative z-10 space-y-6 max-w-lg my-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-blue-200 text-xs font-semibold backdrop-blur-md border border-white/10">
            <ShieldCheck className="h-3.5 w-3.5" /> Start for free — No credit card required
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight leading-tight text-white">
            Get agreements signed <br />
            in minutes today.
          </h1>

          <p className="text-sm text-blue-100/90 leading-relaxed font-normal">
            Join thousands of teams collecting legally compliant electronic signatures faster and smoother than ever before.
          </p>

          <div className="space-y-3 pt-2">
            {[
              "Send up to 10 documents per month on free plan",
              "Full PDF drag and drop signature field layout tool",
              "Instant legal audit certificates & email notifications",
            ].map((feature, i) => (
              <div key={i} className="flex items-center gap-2.5 text-xs text-blue-100 font-medium">
                <CheckCircle2 className="h-4 w-4 text-blue-300 shrink-0" />
                <span>{feature}</span>
              </div>
            ))}
          </div>

          <div className="pt-6">
            <div className="p-4 rounded-xl bg-white/10 backdrop-blur-md border border-white/15 shadow-2xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-blue-400/20 text-blue-200 flex items-center justify-center font-bold">
                  <FileCheck className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-white">Consulting_Contract_V2.pdf</p>
                  <p className="text-[10px] text-blue-200">Ready for instant delivery</p>
                </div>
              </div>
              <span className="text-[10px] font-bold px-2 py-1 rounded bg-blue-400/20 text-blue-200 border border-blue-300/30">
                READY
              </span>
            </div>
          </div>
        </div>

        <div className="relative z-10 text-xs text-blue-200/60 flex items-center justify-between">
          <p>© 2026 ESign Inc. All rights reserved.</p>
          <p>Bank-grade 256-bit SSL</p>
        </div>
      </div>

      {/* RIGHT SIDE: Signup Card */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 overflow-y-auto">
        <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200/80 shadow-sm p-8 sm:p-10 space-y-5 my-auto">
          {/* Mobile Logo */}
          <div className="flex lg:hidden items-center gap-2 justify-center mb-2">
            <div className="h-9 w-9 rounded-xl bg-[#1A56DB] flex items-center justify-center text-white">
              <FileSignature className="h-5 w-5" />
            </div>
            <span className="text-xl font-bold text-slate-900">ESign</span>
          </div>

          {/* Header */}
          <div className="text-center sm:text-left space-y-1">
            <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Create your account</h2>
            <p className="text-xs text-slate-500 font-medium">
              Start sending documents for signature in under 2 minutes
            </p>
          </div>

          {/* Google Sign up */}
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
            {/* Name */}
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-xs font-semibold text-slate-700">Full name</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  id="name"
                  type="text"
                  placeholder="John Doe"
                  autoComplete="name"
                  className={cn("pl-9 h-10 text-xs bg-slate-50/50 border-slate-200 focus:bg-white focus:border-[#1A56DB]", errors.name && "border-rose-500")}
                  {...register("name")}
                />
              </div>
              {errors.name && (
                <p className="text-[11px] text-rose-600 font-medium">{errors.name.message}</p>
              )}
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-semibold text-slate-700">Work email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  id="email"
                  type="email"
                  placeholder="name@company.com"
                  autoComplete="email"
                  className={cn(
                    "pl-9 h-10 text-xs bg-slate-50/50 border-slate-200 focus:bg-white focus:border-[#1A56DB]",
                    (errors.email || emailError) && "border-rose-500"
                  )}
                  {...emailField}
                  onBlur={(e) => {
                    emailField.onBlur(e)
                    handleEmailBlur(e.target.value)
                  }}
                />
              </div>
              {(errors.email || emailError) && (
                <p className="text-[11px] text-rose-600 font-medium">
                  {emailError ?? errors.email?.message}
                </p>
              )}
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-xs font-semibold text-slate-700">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Min. 8 characters"
                  autoComplete="new-password"
                  className={cn("pl-9 pr-9 h-10 text-xs bg-slate-50/50 border-slate-200 focus:bg-white focus:border-[#1A56DB]", errors.password && "border-rose-500")}
                  {...register("password", {
                    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
                      setPasswordValue(e.target.value),
                  })}
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
              {passwordValue && (
                <div className="space-y-1 pt-1">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div
                        key={i}
                        className={cn(
                          "h-1 flex-1 rounded-full transition-colors",
                          i <= strength.score ? strength.color : "bg-slate-200"
                        )}
                      />
                    ))}
                  </div>
                  <p className={cn(
                    "text-[10px] font-semibold",
                    strength.label === "Weak" && "text-rose-600",
                    strength.label === "Fair" && "text-amber-600",
                    strength.label === "Strong" && "text-emerald-600",
                  )}>
                    {strength.label} password
                  </p>
                </div>
              )}
              {errors.password && (
                <p className="text-[11px] text-rose-600 font-medium">{errors.password.message}</p>
              )}
            </div>

            {/* Confirm Password */}
            <div className="space-y-1.5">
              <Label htmlFor="confirmPassword" className="text-xs font-semibold text-slate-700">Confirm password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  id="confirmPassword"
                  type={showConfirm ? "text" : "password"}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  className={cn("pl-9 pr-9 h-10 text-xs bg-slate-50/50 border-slate-200 focus:bg-white focus:border-[#1A56DB]", errors.confirmPassword && "border-rose-500")}
                  {...register("confirmPassword")}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  aria-label={showConfirm ? "Hide confirm password" : "Show confirm password"}
                >
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="text-[11px] text-rose-600 font-medium">{errors.confirmPassword.message}</p>
              )}
            </div>

            {/* Submit Error */}
            {submitError && (
              <div className="rounded-lg bg-rose-50 border border-rose-200 p-3">
                <p className="text-xs text-rose-700 font-medium">{submitError}</p>
              </div>
            )}

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={isSubmitting || !!emailError}
              className="w-full h-10 bg-[#1A56DB] hover:bg-blue-700 text-white font-semibold text-xs shadow-sm shadow-blue-500/20"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating account...
                </>
              ) : (
                "Create Free Account"
              )}
            </Button>
          </form>

          {/* Footer Link */}
          <div className="pt-2 border-t border-slate-100 text-center text-xs text-slate-500">
            Already have an account?{" "}
            <Link href="/login" className="text-[#1A56DB] hover:underline font-bold">
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
