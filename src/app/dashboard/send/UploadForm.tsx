"use client"

import { useState, useRef, DragEvent, ChangeEvent } from "react"
import { useRouter } from "next/navigation"
import { Upload, FileText, X, AlertCircle, Loader2, ShieldCheck, ArrowRight, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

const MAX_FILE_SIZE = 15 * 1024 * 1024 // 15 MB

export function UploadForm() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState("")
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)

  const handleFileChange = (selectedFile: File | null) => {
    setError(null)
    if (!selectedFile) return

    if (!selectedFile.name.toLowerCase().endsWith(".pdf") && selectedFile.type !== "application/pdf") {
      setError("Only PDF files are allowed. Please select a valid .pdf document.")
      return
    }

    if (selectedFile.size > MAX_FILE_SIZE) {
      setError(`File size exceeds 15MB limit. Selected file is ${(selectedFile.size / (1024 * 1024)).toFixed(1)}MB.`)
      return
    }

    setFile(selectedFile)
    const defaultTitle = selectedFile.name.replace(/\.pdf$/i, "")
    setTitle(defaultTitle)
  }

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileChange(e.dataTransfer.files[0])
    }
  }

  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileChange(e.target.files[0])
    }
  }

  const handleClearFile = () => {
    setFile(null)
    setTitle("")
    setError(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) {
      setError("Please select a PDF document to upload.")
      return
    }

    setIsUploading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append("file", file)
      if (title.trim()) {
        formData.append("title", title.trim())
      }

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Failed to upload document")
      }

      // Redirect to document detail page
      if (data.redirectUrl) {
        router.push(data.redirectUrl)
      } else if (data.envelopeId) {
        router.push(`/dashboard/documents/${data.envelopeId}`)
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An unexpected error occurred during upload."
      setError(errorMessage)
      setIsUploading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 pt-2">
      {/* Header */}
      <div className="text-center sm:text-left space-y-1">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
          Upload Document
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 font-medium">
          Upload a PDF document to store securely and prepare for signature.
        </p>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50/90 border border-red-200 text-red-800 text-xs font-medium shadow-xs">
          <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1">{error}</div>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-red-500 hover:text-red-700 text-xs font-bold transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Upload Drop Zone */}
        {!file ? (
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              "relative flex flex-col items-center justify-center p-8 sm:p-14 border-2 border-dashed rounded-3xl cursor-pointer transition-all duration-200 group bg-white",
              isDragging
                ? "border-[#1A56DB] bg-blue-50/70 scale-[1.005] shadow-md shadow-blue-500/10"
                : "border-slate-200 hover:border-blue-400 hover:bg-slate-50/80 shadow-xs"
            )}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              onChange={handleFileInputChange}
              className="hidden"
            />
            <div className="h-16 w-16 rounded-2xl bg-blue-50 text-[#1A56DB] flex items-center justify-center mb-4 ring-8 ring-blue-50/50 group-hover:scale-105 transition-transform">
              <Upload className="h-7 w-7" />
            </div>
            <p className="text-sm sm:text-base font-bold text-slate-900 text-center">
              Drag & drop your PDF document here
            </p>
            <p className="text-xs text-slate-500 text-center mt-1.5 font-medium">
              or <span className="text-[#1A56DB] font-semibold underline underline-offset-2">browse files</span> from your computer
            </p>
            <div className="flex items-center gap-2 mt-6 px-3.5 py-1.5 rounded-full bg-slate-100/80 text-[11px] text-slate-600 font-medium border border-slate-200/60">
              <ShieldCheck className="h-3.5 w-3.5 text-blue-600" />
              <span>PDF only • Maximum 15 MB</span>
            </div>
          </div>
        ) : (
          /* Selected File Card */
          <div className="rounded-2xl border border-slate-200/90 bg-white p-6 space-y-5 shadow-xs">
            {/* File Info Row */}
            <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-4 min-w-0">
                <div className="h-12 w-12 rounded-xl bg-blue-50 text-[#1A56DB] flex items-center justify-center shrink-0 ring-1 ring-blue-500/10">
                  <FileText className="h-6 w-6" />
                </div>
                <div className="min-w-0 space-y-0.5">
                  <p className="text-sm font-bold text-slate-900 truncate">
                    {file.name}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                    <span>{(file.size / (1024 * 1024)).toFixed(2)} MB</span>
                    <span>•</span>
                    <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold">
                      <CheckCircle2 className="h-3 w-3" /> Ready to upload
                    </span>
                  </div>
                </div>
              </div>
              {!isUploading && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleClearFile}
                  className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 h-9 w-9 p-0 rounded-full transition-colors shrink-0"
                  title="Remove file"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>

            {/* Document Title Input */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="doc-title" className="text-xs font-bold text-slate-800 tracking-wide uppercase">
                  Document Title
                </Label>
                <span className="text-[11px] text-slate-400 font-medium">Shown on signature requests</span>
              </div>
              <Input
                id="doc-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={isUploading}
                placeholder="Enter document title (e.g. Service Agreement 2026)"
                className="h-10 text-xs sm:text-sm px-3.5 bg-white border-[#E2E8F0] hover:border-[#3F83F8] focus:border-[#1A56DB] focus:ring-2 focus:ring-[#1A56DB]/20 rounded-xl font-medium text-[#0F172A] placeholder:text-slate-500"
              />
            </div>
          </div>
        )}

        {/* Submit Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button
            type="submit"
            disabled={!file || isUploading}
            className="group bg-gradient-to-r from-[#1A56DB] to-blue-600 hover:from-blue-700 hover:to-blue-800 text-white font-semibold text-xs sm:text-sm h-10 px-6 rounded-xl shadow-md shadow-blue-500/20 hover:shadow-lg hover:shadow-blue-500/30 transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
          >
            {isUploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Uploading PDF...
              </>
            ) : (
              <>
                Upload & Continue
                <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-0.5 transition-transform" />
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}
