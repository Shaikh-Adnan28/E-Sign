"use client"

import { useState, useRef, DragEvent, ChangeEvent } from "react"
import { useRouter } from "next/navigation"
import { Upload, FileText, X, AlertCircle, Loader2, ShieldCheck, ArrowRight } from "lucide-react"
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
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
          Upload Document
        </h1>
        <p className="text-xs text-slate-500 mt-1 font-medium">
          Upload a PDF document to store securely and prepare for signature.
        </p>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="flex items-start gap-3 p-3.5 rounded-xl bg-red-50 border border-red-200/80 text-red-800 text-xs font-medium">
          <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1">{error}</div>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-red-500 hover:text-red-700 text-xs font-bold"
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
              "relative flex flex-col items-center justify-center p-8 sm:p-12 border-2 border-dashed rounded-2xl cursor-pointer transition-all duration-200",
              isDragging
                ? "border-[#1A56DB] bg-blue-50/60 scale-[1.005]"
                : "border-slate-300/80 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-400"
            )}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              onChange={handleFileInputChange}
              className="hidden"
            />
            <div className="h-14 w-14 rounded-2xl bg-blue-50 text-[#1A56DB] flex items-center justify-center mb-4 shadow-sm">
              <Upload className="h-7 w-7" />
            </div>
            <p className="text-sm font-semibold text-slate-900 text-center">
              Drag & drop your PDF document here
            </p>
            <p className="text-xs text-slate-500 text-center mt-1">
              or <span className="text-[#1A56DB] font-medium underline">browse files</span> from your computer
            </p>
            <div className="flex items-center gap-2 mt-6 px-3 py-1 rounded-full bg-slate-200/60 text-[11px] text-slate-600 font-medium">
              <ShieldCheck className="h-3.5 w-3.5 text-slate-500" />
              <span>PDF only, maximum 15 MB</span>
            </div>
          </div>
        ) : (
          /* Selected File Card */
          <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4 shadow-2xs">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="h-11 w-11 rounded-xl bg-blue-50 text-[#1A56DB] flex items-center justify-center shrink-0">
                  <FileText className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">
                    {file.name}
                  </p>
                  <p className="text-xs text-slate-400">
                    {(file.size / (1024 * 1024)).toFixed(2)} MB • PDF Document
                  </p>
                </div>
              </div>
              {!isUploading && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleClearFile}
                  className="text-slate-400 hover:text-slate-600 h-8 w-8 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>

            {/* Document Title Input */}
            <div className="space-y-1.5 pt-2 border-t border-slate-100">
              <Label htmlFor="doc-title" className="text-xs font-semibold text-slate-700">
                Document Title
              </Label>
              <Input
                id="doc-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={isUploading}
                placeholder="e.g. Sales Agreement 2026"
                className="h-9 text-xs"
              />
            </div>
          </div>
        )}

        {/* Submit Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button
            type="submit"
            disabled={!file || isUploading}
            className="bg-[#1A56DB] hover:bg-blue-700 text-white font-medium text-xs h-9 px-5 shadow-sm shadow-blue-500/20"
          >
            {isUploading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />
                Uploading PDF...
              </>
            ) : (
              <>
                Upload & Continue
                <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}
