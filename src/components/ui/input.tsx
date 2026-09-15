import * as React from "react"

import { cn } from "@/lib/utils"

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-xl border border-[#E2E8F0] bg-white px-3.5 py-2 text-sm font-medium text-[#0F172A] transition-all hover:border-[#3F83F8] placeholder:text-slate-500 placeholder:font-normal focus-visible:outline-none focus-visible:border-[#1A56DB] focus-visible:ring-2 focus-visible:ring-[#1A56DB]/20 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-60 disabled:text-slate-400 shadow-2xs",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }