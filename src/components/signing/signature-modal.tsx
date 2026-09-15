'use client';

import { useRef, useState, useEffect } from "react";
import { X, Trash2, PenLine, Type } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface SignatureModalProps {
  title?: string;
  onConfirm: (dataUrl: string) => void;
  onClose: () => void;
}

const CANVAS_W = 420;
const CANVAS_H = 150;

export function SignatureModal({
  title = "Draw your signature",
  onConfirm,
  onClose,
}: SignatureModalProps) {
  const [tab, setTab] = useState<"draw" | "type">("draw");
  const [typedName, setTypedName] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  // Set up canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, [tab]);

  function getPos(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = canvasRef.current!.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (CANVAS_W / rect.width),
      y: (e.clientY - rect.top) * (CANVAS_H / rect.height),
    };
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    drawing.current = true;
    lastPos.current = getPos(e);
    canvasRef.current!.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current || !lastPos.current) return;
    const ctx = canvasRef.current!.getContext("2d")!;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastPos.current = pos;
  }

  function onPointerUp() {
    drawing.current = false;
    lastPos.current = null;
  }

  function clearCanvas() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  }

  function typeToDataUrl(name: string): string {
    const canvas = document.createElement("canvas");
    canvas.width = CANVAS_W;
    canvas.height = CANVAS_H;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.fillStyle = "#1e293b";
    // Try a cursive-looking font; falls back to system
    ctx.font = `italic ${Math.min(CANVAS_H * 0.55, 56)}px 'Georgia', 'Times New Roman', serif`;
    ctx.textBaseline = "middle";
    ctx.fillText(name, 16, CANVAS_H / 2);
    return canvas.toDataURL("image/png");
  }

  function handleConfirm() {
    if (tab === "draw") {
      const canvas = canvasRef.current;
      if (!canvas) return;
      onConfirm(canvas.toDataURL("image/png"));
    } else {
      if (!typedName.trim()) return;
      onConfirm(typeToDataUrl(typedName.trim()));
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <h2 className="text-base font-bold text-[#0F172A]">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-100 bg-slate-50/30">
          {(["draw", "type"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-3 text-sm font-semibold gap-1.5 flex items-center justify-center transition-colors ${
                tab === t
                  ? "text-[#1A56DB] border-b-2 border-[#1A56DB] bg-white"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {t === "draw" ? <PenLine size={14} /> : <Type size={14} />}
              {t === "draw" ? "Draw Signature" : "Type Signature"}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-6">
          {tab === "draw" ? (
            <div className="flex flex-col gap-3">
              <p className="text-xs text-slate-500 font-medium">Sign in the box below using your mouse or touch.</p>
              <div className="relative border-2 border-slate-200 rounded-xl overflow-hidden bg-white shadow-inner" style={{ height: CANVAS_H }}>
                <canvas
                  ref={canvasRef}
                  width={CANVAS_W}
                  height={CANVAS_H}
                  className="w-full touch-none cursor-crosshair"
                  onPointerDown={onPointerDown}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                />
                {/* baseline */}
                <div className="absolute bottom-8 left-6 right-6 border-b border-slate-200 pointer-events-none" />
              </div>
              <button
                onClick={clearCanvas}
                className="self-start flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 transition-colors"
              >
                <Trash2 size={12} /> Clear Canvas
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-xs text-slate-500 font-medium">Type your full name to generate a styled signature.</p>
              <Label htmlFor="sig-typed-name" className="text-xs font-semibold text-[#0F172A]">Full Name</Label>
              <Input
                id="sig-typed-name"
                type="text"
                placeholder="Enter your full name clearly..."
                value={typedName}
                onChange={(e) => setTypedName(e.target.value)}
                className="h-11 text-sm font-medium text-[#0F172A] placeholder:text-slate-500 border-[#E2E8F0] hover:border-[#3F83F8] focus:border-[#1A56DB] focus:ring-2 focus:ring-[#1A56DB]/20"
                autoFocus
              />
              {typedName && (
                <div
                  className="w-full border border-slate-200 rounded-xl px-4 py-4 bg-slate-50 text-center shadow-inner mt-1"
                  style={{
                    fontFamily: "'Georgia', 'Times New Roman', serif",
                    fontStyle: "italic",
                    fontSize: "clamp(24px, 5vw, 40px)",
                    color: "#0F172A",
                    minHeight: 80,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {typedName}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 bg-slate-50/80 border-t border-slate-100 rounded-b-2xl">
          <Button
            variant="outline"
            className="flex-1 border-[#E2E8F0] text-slate-700 hover:bg-white hover:border-slate-300 font-semibold"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            className="flex-1 bg-[#1A56DB] hover:bg-blue-700 text-white font-semibold shadow-xs"
            onClick={handleConfirm}
            disabled={tab === "type" && !typedName.trim()}
          >
            Apply Signature
          </Button>
        </div>
      </div>
    </div>
  );
}
