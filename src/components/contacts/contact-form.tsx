"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Loader2 } from "lucide-react"

export const contactSchema = z.object({
  name: z.string().min(1, "Name is required").max(255).trim(),
  email: z.string().email("Invalid email address").max(255).trim().toLowerCase(),
  company: z.string().max(255).trim().optional().or(z.literal("")),
  phone: z
    .string()
    .max(50)
    .trim()
    .optional()
    .or(z.literal(""))
    .refine(
      (val) => !val || /^[+\d\s\-().]{0,50}$/.test(val),
      "Invalid phone number"
    ),
  tags: z.string().max(255).trim().optional().or(z.literal("")),
  notes: z.string().max(2000).trim().optional().or(z.literal("")),
})

export type ContactFormData = z.infer<typeof contactSchema>

interface ContactFormProps {
  defaultValues?: Partial<ContactFormData>
  onSubmit: (data: ContactFormData) => Promise<void>
  submitLabel: string
  onCancel: () => void
  isLoading?: boolean
  error?: string | null
}

export function ContactForm({
  defaultValues,
  onSubmit,
  submitLabel,
  onCancel,
  isLoading,
  error,
}: ContactFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      name: "",
      email: "",
      company: "",
      phone: "",
      tags: "",
      notes: "",
      ...defaultValues,
    },
  })

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Name */}
      <div className="space-y-1.5">
        <Label htmlFor="name">
          Name <span className="text-red-500">*</span>
        </Label>
        <Input
          id="name"
          placeholder="Jane Smith"
          autoComplete="name"
          {...register("name")}
        />
        {errors.name && (
          <p className="text-xs text-red-500">{errors.name.message}</p>
        )}
      </div>

      {/* Email */}
      <div className="space-y-1.5">
        <Label htmlFor="email">
          Email <span className="text-red-500">*</span>
        </Label>
        <Input
          id="email"
          type="email"
          placeholder="jane@example.com"
          autoComplete="email"
          {...register("email")}
        />
        {errors.email && (
          <p className="text-xs text-red-500">{errors.email.message}</p>
        )}
      </div>

      {/* Company */}
      <div className="space-y-1.5">
        <Label htmlFor="company">Company</Label>
        <Input
          id="company"
          placeholder="Acme Corp"
          autoComplete="organization"
          {...register("company")}
        />
        {errors.company && (
          <p className="text-xs text-red-500">{errors.company.message}</p>
        )}
      </div>

      {/* Phone */}
      <div className="space-y-1.5">
        <Label htmlFor="phone">Phone</Label>
        <Input
          id="phone"
          type="tel"
          placeholder="+1 (555) 000-0000"
          autoComplete="tel"
          {...register("phone")}
        />
        {errors.phone && (
          <p className="text-xs text-red-500">{errors.phone.message}</p>
        )}
      </div>

      {/* Tags */}
      <div className="space-y-1.5">
        <Label htmlFor="tags">Tags</Label>
        <Input
          id="tags"
          placeholder="Client, Vendor, VIP, Executive..."
          {...register("tags")}
          className="h-9 text-xs"
        />
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-[10px] text-slate-400 font-semibold uppercase">Popular:</span>
          {["Client", "Vendor", "Employee", "Partner", "VIP"].map((popularTag) => (
            <button
              key={popularTag}
              type="button"
              onClick={() => {
                const current = (defaultValues?.tags || "").split(",").map((t) => t.trim()).filter(Boolean);
                if (!current.includes(popularTag)) {
                  const tagInput = document.getElementById("tags") as HTMLInputElement;
                  if (tagInput) {
                    tagInput.value = tagInput.value ? `${tagInput.value}, ${popularTag}` : popularTag;
                    tagInput.dispatchEvent(new Event("input", { bubbles: true }));
                  }
                }
              }}
              className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 hover:bg-blue-100 text-slate-600 hover:text-blue-700 transition-colors border border-slate-200"
            >
              + {popularTag}
            </button>
          ))}
        </div>
        {errors.tags && (
          <p className="text-xs text-red-500">{errors.tags.message}</p>
        )}
      </div>

      {/* Notes */}
      <div className="space-y-1.5">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          rows={3}
          placeholder="Any additional notes..."
          className="resize-none"
          {...register("notes")}
        />
        {errors.notes && (
          <p className="text-xs text-red-500">{errors.notes.message}</p>
        )}
      </div>

      {/* API-level error */}
      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isLoading}
        >
          Cancel
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}
