"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, UserCheck } from "lucide-react"
import { RecipientPicker, type SelectedRecipient } from "@/components/contacts/RecipientPicker"

interface RoleInput {
  roleId: string
  roleName: string
  order: number
  email: string
  name: string
}

interface UseTemplateModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  template: {
    id: string
    name: string
    roles: Array<{ id: string; roleName: string; order: number }>
  } | null
}

export function UseTemplateModal({
  open,
  onOpenChange,
  template,
}: UseTemplateModalProps) {
  const router = useRouter()
  const [title, setTitle] = useState("")
  const [roleInputs, setRoleInputs] = useState<RoleInput[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (template) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTitle(template.name)
      setRoleInputs(
        template.roles.map((r) => ({
          roleId: r.id,
          roleName: r.roleName,
          order: r.order,
          email: "",
          name: "",
        }))
      )
    }
  }, [template])

  function handleRecipientChange(index: number, selected: SelectedRecipient | null) {
    setRoleInputs((prev) =>
      prev.map((item, i) =>
        i === index
          ? {
              ...item,
              name: selected?.name || "",
              email: selected?.email || "",
            }
          : item
      )
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!template) return

    for (const r of roleInputs) {
      if (!r.email.trim()) {
        setError(`Email is required for role: ${r.roleName}`)
        return
      }
    }

    setIsLoading(true)
    setError(null)

    try {
      const res = await fetch(`/api/templates/${template.id}/use`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim() || template.name,
          recipients: roleInputs.map((r) => ({
            roleId: r.roleId,
            email: r.email.trim(),
            name: r.name.trim() || undefined,
          })),
        }),
      })

      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? "Failed to create document from template.")
        return
      }

      onOpenChange(false)
      // Redirect to created document detail or send review
      router.push(`/dashboard/documents/${json.envelopeId}`)
    } catch {
      setError("An unexpected error occurred. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-slate-900">
            Use Template: {template?.name}
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Assign real people to the template&apos;s signer roles to generate a new document request.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Document Title */}
          <div className="space-y-1.5">
            <Label htmlFor="doc-title" className="text-xs font-semibold text-slate-700">
              Document Title
            </Label>
            <Input
              id="doc-title"
              placeholder="e.g. Employment Agreement - John Doe"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="h-9 text-xs"
              required
            />
          </div>

          {/* Role Recipient Mapping */}
          <div className="space-y-3 pt-1">
            <Label className="text-xs font-semibold text-slate-700 block">
              Assign Recipients to Roles
            </Label>

            {roleInputs.map((role, idx) => (
              <div
                key={role.roleId}
                className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2.5 relative"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#1A56DB] flex items-center gap-1.5">
                    <UserCheck className="h-4 w-4" /> Role {role.order}: {role.roleName}
                  </span>
                </div>

                <RecipientPicker
                  value={role.email ? { name: role.name, email: role.email } : null}
                  onChange={(selected) => handleRecipientChange(idx, selected)}
                  placeholder={`Search address book or enter recipient for ${role.roleName}...`}
                />
              </div>
            ))}
          </div>

          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg p-2.5">
              {error}
            </p>
          )}

          {/* Modal Actions */}
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
              className="h-9 text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="h-9 text-xs font-semibold bg-[#1A56DB] hover:bg-blue-700 text-white"
            >
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Generate Document
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

