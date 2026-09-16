"use client"

import { useState } from "react"
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
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Loader2, Plus, Trash2, Upload, FileText, Code2 } from "lucide-react"

interface CreateTemplateModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CreateTemplateModal({
  open,
  onOpenChange,
}: CreateTemplateModalProps) {
  const router = useRouter()
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [roles, setRoles] = useState<string[]>(["Signer 1", "Signer 2"])
  const [method, setMethod] = useState<"pdf" | "html">("pdf")
  const [file, setFile] = useState<File | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function addRole() {
    setRoles((prev) => [...prev, `Signer ${prev.length + 1}`])
  }

  function removeRole(index: number) {
    if (roles.length <= 1) return
    setRoles((prev) => prev.filter((_, i) => i !== index))
  }

  function updateRole(index: number, val: string) {
    setRoles((prev) => prev.map((r, i) => (i === index ? val : r)))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      setError("Template name is required.")
      return
    }

    if (method === "html") {
      const qs = new URLSearchParams()
      qs.set("name", name.trim())
      if (description.trim()) qs.set("description", description.trim())
      qs.set("roles", JSON.stringify(roles.map((r) => r.trim()).filter(Boolean)))
      
      onOpenChange(false)
      router.push(`/dashboard/templates/html/new?${qs.toString()}`)
      return
    }

    if (!file) {
      setError("Please select a PDF document.")
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append("name", name.trim())
      if (description.trim()) formData.append("description", description.trim())
      formData.append("roles", JSON.stringify(roles.map((r) => r.trim()).filter(Boolean)))
      formData.append("file", file)

      const res = await fetch("/api/templates", {
        method: "POST",
        body: formData,
      })

      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? "Failed to create template.")
        return
      }

      onOpenChange(false)
      // Redirect to template editor
      router.push(`/dashboard/templates/editor/${json.id}`)
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
            Create Reusable Template
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Upload a PDF document or build with HTML, and define reusable signer roles.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Creation Method */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setMethod("pdf")}
              className={`flex flex-col items-center justify-center p-3 border-2 rounded-xl transition-colors ${
                method === "pdf" ? "border-[#1A56DB] bg-blue-50 text-[#1A56DB]" : "border-slate-200 hover:border-slate-300"
              }`}
            >
              <Upload className="w-5 h-5 mb-1" />
              <span className="text-xs font-bold">Upload PDF</span>
            </button>
            <button
              type="button"
              onClick={() => setMethod("html")}
              className={`flex flex-col items-center justify-center p-3 border-2 rounded-xl transition-colors ${
                method === "html" ? "border-[#1A56DB] bg-blue-50 text-[#1A56DB]" : "border-slate-200 hover:border-slate-300"
              }`}
            >
              <Code2 className="w-5 h-5 mb-1" />
              <span className="text-xs font-bold">Build with HTML</span>
            </button>
          </div>

          {/* Template Name */}
          <div className="space-y-1.5">
            <Label htmlFor="tmpl-name" className="text-xs font-semibold text-slate-700">
              Template Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="tmpl-name"
              placeholder="e.g. Standard Employment Agreement"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-9 text-xs"
              required
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="tmpl-desc" className="text-xs font-semibold text-slate-700">
              Description (Optional)
            </Label>
            <Textarea
              id="tmpl-desc"
              rows={2}
              placeholder="Brief description of when to use this template..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="text-xs resize-none"
            />
          </div>

          {/* PDF Upload - only show if method is pdf */}
          {method === "pdf" && (
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">
                Template PDF Document <span className="text-red-500">*</span>
              </Label>
              <div className="flex items-center justify-center w-full">
                <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-slate-300 rounded-xl cursor-pointer bg-slate-50 hover:bg-slate-100/80 transition-colors">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6 px-4 text-center">
                    {file ? (
                      <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                        <FileText className="h-5 w-5 text-[#1A56DB]" />
                        <span className="truncate max-w-[240px]">{file.name}</span>
                      </div>
                    ) : (
                      <>
                        <Upload className="w-6 h-6 mb-2 text-slate-400" />
                        <p className="text-xs text-slate-600 font-semibold">
                          Click to upload or drag PDF
                        </p>
                        <p className="text-[10px] text-slate-400">PDF documents up to 25MB</p>
                      </>
                    )}
                  </div>
                  <input
                    type="file"
                    accept="application/pdf"
                    className="hidden"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  />
                </label>
              </div>
            </div>
          )}

          {/* Signer Roles */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold text-slate-700">
                Signer Roles
              </Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={addRole}
                className="h-7 text-xs text-[#1A56DB] hover:bg-blue-50 px-2"
              >
                <Plus className="h-3.5 w-3.5 mr-1" /> Add Role
              </Button>
            </div>
            <div className="space-y-2">
              {roles.map((role, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-slate-400 w-5">
                    #{idx + 1}
                  </span>
                  <Input
                    value={role}
                    onChange={(e) => updateRole(idx, e.target.value)}
                    placeholder={`Role ${idx + 1}`}
                    className="h-8 text-xs flex-1"
                  />
                  {roles.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeRole(idx)}
                      className="h-8 w-8 p-0 text-slate-400 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
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
              {method === "html" ? "Continue to HTML Builder" : "Create & Prepare Fields"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
