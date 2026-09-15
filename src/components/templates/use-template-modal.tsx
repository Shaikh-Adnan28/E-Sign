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
import { Loader2, Users, UserCheck } from "lucide-react"
import type { Contact } from "@/lib/db/schema"

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
  const [contacts, setContacts] = useState<Contact[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeContactPickerIdx, setActiveContactPickerIdx] = useState<number | null>(null)

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

  useEffect(() => {
    if (open) {
      // Fetch contacts for quick selection
      fetch("/api/contacts?limit=50")
        .then((res) => (res.ok ? res.json() : { data: [] }))
        .then((json) => setContacts(json.data || []))
        .catch(() => {})
    }
  }, [open])

  function updateRoleInput(index: number, key: "email" | "name", val: string) {
    setRoleInputs((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [key]: val } : item))
    )
  }

  function applyContact(index: number, contact: Contact) {
    setRoleInputs((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, name: contact.name, email: contact.email } : item
      )
    )
    setActiveContactPickerIdx(null)
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

                  {contacts.length > 0 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setActiveContactPickerIdx(
                          activeContactPickerIdx === idx ? null : idx
                        )
                      }
                      className="h-6 text-[11px] text-slate-600 hover:text-blue-600 px-2"
                    >
                      <Users className="h-3 w-3 mr-1" /> Select Contact
                    </Button>
                  )}
                </div>

                {/* Contacts Picker Dropdown */}
                {activeContactPickerIdx === idx && (
                  <div className="absolute right-3 top-10 z-20 w-64 bg-white border border-slate-200 rounded-xl shadow-lg p-2 max-h-48 overflow-y-auto space-y-1">
                    <div className="text-[10px] font-bold text-slate-400 px-2 py-1 uppercase">
                      Select Contact
                    </div>
                    {contacts.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => applyContact(idx, c)}
                        className="w-full text-left px-2 py-1.5 rounded hover:bg-blue-50 text-xs transition-colors truncate"
                      >
                        <span className="font-bold text-slate-900 block truncate">
                          {c.name}
                        </span>
                        <span className="text-[10px] text-slate-500 block truncate">
                          {c.email}
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Input
                    placeholder="Recipient Full Name"
                    value={role.name}
                    onChange={(e) => updateRoleInput(idx, "name", e.target.value)}
                    className="h-8 text-xs bg-white"
                  />
                  <Input
                    type="email"
                    placeholder="Recipient Email *"
                    value={role.email}
                    onChange={(e) => updateRoleInput(idx, "email", e.target.value)}
                    className="h-8 text-xs bg-white"
                    required
                  />
                </div>
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
