"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2, Plus, Trash2, Code2, Play } from "lucide-react"

export function HtmlBuilder({ 
  name, 
  description, 
  roles 
}: { 
  name: string, 
  description: string, 
  roles: string[] 
}) {
  const router = useRouter()
  const [html, setHtml] = useState(`<h1>Employment Agreement</h1>\n<p>This agreement is between the employer and {{employee_name}}.</p>`)
  const [css, setCss] = useState(`h1 { color: #1A56DB; font-family: sans-serif; }\np { font-size: 14px; font-family: sans-serif; line-height: 1.5; }`)
  const [variables, setVariables] = useState<Record<string, string>>({ employee_name: "John Doe" })
  
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string|null>(null)
  const [activeTab, setActiveTab] = useState<"html" | "css" | "vars">("html")
  
  const iframeRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    if (!iframeRef.current) return
    const doc = iframeRef.current.contentDocument
    if (!doc) return
    
    let processedHtml = html
    for (const [k, v] of Object.entries(variables)) {
      processedHtml = processedHtml.replace(new RegExp(`\\{\\{\\s*${k}\\s*\\}\\}`, 'g'), v)
    }
    
    doc.open()
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body { margin: 0; padding: 20px; box-sizing: border-box; }
            ${css}
          </style>
        </head>
        <body>${processedHtml}</body>
      </html>
    `)
    doc.close()
  }, [html, css, variables])

  const [isAddingVar, setIsAddingVar] = useState(false)
  const [newVarName, setNewVarName] = useState("")

  const submitNewVariable = () => {
    if (newVarName.trim() && !variables[newVarName.trim()]) {
      setVariables(prev => ({ ...prev, [newVarName.trim()]: "Sample Value" }))
    }
    setNewVarName("")
    setIsAddingVar(false)
  }

  const removeVariable = (k: string) => {
    setVariables(prev => {
      const copy = { ...prev }
      delete copy[k]
      return copy
    })
  }

  const updateVariable = (k: string, v: string) => {
    setVariables(prev => ({ ...prev, [k]: v }))
  }

  const handleGenerate = async () => {
    setIsGenerating(true)
    setError(null)
    try {
      const res = await fetch("/api/templates/html", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, roles, htmlSource: html, htmlCss: css, variables })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to generate template")
      
      router.push(`/dashboard/templates/editor/${data.id}`)
    } catch (err: any) {
      setError(err.message)
      setIsGenerating(false)
    }
  }

  return (
    <div className="flex h-full w-full">
      {/* LEFT PANEL: Editor */}
      <div className="w-1/3 min-w-[350px] border-r bg-slate-50 flex flex-col h-full">
        {/* Editor Tabs */}
        <div className="flex items-center border-b bg-white">
          <button 
            className={`flex-1 py-3 text-xs font-bold ${activeTab === "html" ? "border-b-2 border-[#1A56DB] text-[#1A56DB]" : "text-slate-500 hover:bg-slate-50"}`}
            onClick={() => setActiveTab("html")}
          >
            HTML
          </button>
          <button 
            className={`flex-1 py-3 text-xs font-bold ${activeTab === "css" ? "border-b-2 border-[#1A56DB] text-[#1A56DB]" : "text-slate-500 hover:bg-slate-50"}`}
            onClick={() => setActiveTab("css")}
          >
            CSS
          </button>
          <button 
            className={`flex-1 py-3 text-xs font-bold ${activeTab === "vars" ? "border-b-2 border-[#1A56DB] text-[#1A56DB]" : "text-slate-500 hover:bg-slate-50"}`}
            onClick={() => setActiveTab("vars")}
          >
            Variables
          </button>
        </div>

        {/* Editor Content */}
        <div className="flex-1 p-4 overflow-y-auto">
          {activeTab === "html" && (
            <div className="h-full flex flex-col">
              <Label className="text-xs font-bold text-slate-700 mb-2">HTML Source (Body)</Label>
              <Textarea 
                value={html}
                onChange={e => setHtml(e.target.value)}
                className="flex-1 font-mono text-xs resize-none p-4"
                placeholder="<h1>Hello {{name}}</h1>"
              />
            </div>
          )}
          
          {activeTab === "css" && (
            <div className="h-full flex flex-col">
              <Label className="text-xs font-bold text-slate-700 mb-2">Custom CSS</Label>
              <Textarea 
                value={css}
                onChange={e => setCss(e.target.value)}
                className="flex-1 font-mono text-xs resize-none p-4"
                placeholder="h1 { color: red; }"
              />
            </div>
          )}

          {activeTab === "vars" && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <Label className="text-xs font-bold text-slate-700">Test Variables</Label>
                <Button size="sm" variant="outline" onClick={() => setIsAddingVar(true)} className="h-7 text-xs">
                  <Plus className="w-3 h-3 mr-1" /> Add
                </Button>
              </div>
              <p className="text-[11px] text-slate-500 mb-4 leading-relaxed">
                Define variables used in your HTML as <code>{`{{variable_name}}`}</code>. 
                These sample values are for previewing only; actual values will be provided when sending.
              </p>
              
              <div className="space-y-3">
                {isAddingVar && (
                  <div className="flex gap-2 items-center mb-3 bg-slate-100 p-2.5 rounded-lg border border-slate-200">
                    <div className="flex-1">
                      <Label className="text-[10px] font-mono font-bold text-[#1A56DB] uppercase">New Variable</Label>
                      <Input 
                        autoFocus
                        value={newVarName} 
                        onChange={(e) => setNewVarName(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                        onKeyDown={(e) => e.key === 'Enter' && submitNewVariable()}
                        placeholder="e.g. company_name"
                        className="h-8 text-xs font-mono mt-1 bg-white" 
                      />
                    </div>
                    <div className="flex flex-col gap-1 mt-4">
                      <Button size="sm" className="h-7 px-3 bg-[#1A56DB] hover:bg-blue-700 text-[10px]" onClick={submitNewVariable}>Save</Button>
                      <Button size="sm" variant="ghost" className="h-7 px-3 text-slate-500 text-[10px]" onClick={() => { setIsAddingVar(false); setNewVarName(""); }}>Cancel</Button>
                    </div>
                  </div>
                )}
                
                {Object.entries(variables).map(([k, v]) => (
                  <div key={k} className="flex gap-2 items-center">
                    <div className="flex-1">
                      <Label className="text-[10px] font-mono font-bold text-slate-500 uppercase">{k}</Label>
                      <Input 
                        value={v} 
                        onChange={(e) => updateVariable(k, e.target.value)}
                        className="h-8 text-xs font-mono mt-1" 
                      />
                    </div>
                    <Button variant="ghost" size="icon" className="mt-4 text-slate-400 hover:text-red-500" onClick={() => removeVariable(k)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
                {Object.keys(variables).length === 0 && (
                  <div className="text-center p-6 border border-dashed rounded-lg text-slate-400 text-xs font-medium">
                    No variables defined.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* RIGHT PANEL: Preview */}
      <div className="flex-1 bg-slate-200 flex flex-col items-center p-8 overflow-y-auto relative">
        {/* A4 Paper Container */}
        <div className="w-[794px] h-[1123px] bg-white shadow-xl flex-shrink-0 relative">
          <iframe 
            ref={iframeRef}
            className="w-full h-full border-0 pointer-events-none"
            sandbox="allow-same-origin"
            title="PDF Preview"
          />
        </div>

        {/* Floating Actions */}
        <div className="fixed bottom-6 right-6 flex items-center gap-3 bg-white p-2 rounded-xl shadow-lg border border-slate-200">
          {error && <span className="text-xs text-red-500 font-semibold px-2 max-w-[200px] truncate" title={error}>{error}</span>}
          <Button 
            variant="ghost" 
            onClick={() => router.back()}
            className="h-9 text-xs"
            disabled={isGenerating}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleGenerate}
            disabled={isGenerating}
            className="h-9 text-xs bg-[#1A56DB] hover:bg-blue-700 text-white font-semibold"
          >
            {isGenerating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
            Generate PDF
          </Button>
        </div>
      </div>
    </div>
  )
}
