import os

files = {
    "src/lib/tokens.ts": """import crypto from 'crypto';

export function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}
""",

    "src/lib/email.ts": """export interface EmailProvider {
  sendEmail(to: string, subject: string, body: string): Promise<void>;
}

export class DevConsoleEmailProvider implements EmailProvider {
  async sendEmail(to: string, subject: string, body: string): Promise<void> {
    console.log(`[EMAIL to ${to}]: ${subject}\\n${body}\\n`);
  }
}

export const emailProvider = new DevConsoleEmailProvider();
""",

    "src/lib/pdf.ts": """import { PDFDocument, rgb } from 'pdf-lib';
import type { SignatureField } from '@/lib/db/schema';

export async function stampSignedDocument(pdfBytes: Uint8Array, fields: SignatureField[]): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const pages = pdfDoc.getPages();

  for (const field of fields) {
    if (!field.value) continue;
    
    // Page is 1-indexed in our DB, but getPages is 0-indexed
    const pageIndex = field.pageNumber - 1;
    if (pageIndex < 0 || pageIndex >= pages.length) continue;
    
    const page = pages[pageIndex];
    const { width: pageWidth, height: pageHeight } = page.getSize();
    
    // Coordinates are stored as normalized percentages (0-1)
    const x = Number(field.x) * pageWidth;
    const y = Number(field.y) * pageHeight;
    const w = Number(field.width) * pageWidth;
    const h = Number(field.height) * pageHeight;

    // Draw a box and the value (placeholder stamping logic)
    page.drawRectangle({
      x,
      y: pageHeight - y - h, // Adjust y depending on origin, typically bottom-left in PDF
      width: w,
      height: h,
      borderColor: rgb(0, 0, 0),
      borderWidth: 1,
    });
    
    page.drawText(field.value, {
      x: x + 2,
      y: pageHeight - y - h + 2,
      size: 12,
      color: rgb(0, 0, 0),
    });
  }

  return pdfDoc.save();
}
""",

    "src/lib/services/completion.ts": """import { db } from '@/lib/db';
import { envelopes, signers, documents, signatureFields, auditEvents } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { stampSignedDocument } from '@/lib/pdf';
import fs from 'fs';
import path from 'path';

export async function checkAndCompleteEnvelope(envelopeId: string) {
  // Check if all signers have signed
  const allSigners = await db.select().from(signers).where(eq(signers.envelopeId, envelopeId));
  
  const allSigned = allSigners.every(s => s.status === 'SIGNED' || s.status === 'DECLINED');
  
  if (!allSigned) return; // not ready yet
  
  const hasDeclined = allSigners.some(s => s.status === 'DECLINED');
  if (hasDeclined) {
     await db.update(envelopes).set({ status: 'DECLINED' }).where(eq(envelopes.id, envelopeId));
     return;
  }

  // Complete
  await db.update(envelopes).set({ status: 'COMPLETED' }).where(eq(envelopes.id, envelopeId));
  
  // Log audit
  await db.insert(auditEvents).values({
    envelopeId,
    event: 'ENVELOPE_COMPLETED',
  });

  // Stamp PDF - in a real app, we'd fetch the document from S3, stamp it, and re-upload.
  // Here we will just record completion.
}
""",
    
    "src/stores/editor-store.ts": """import { create } from 'zustand';

type Field = any;

interface EditorState {
  fields: Field[];
  addField: (field: Field) => void;
  updateField: (id: string, updates: Partial<Field>) => void;
  removeField: (id: string) => void;
}

export const useEditorStore = create<EditorState>((set) => ({
  fields: [],
  addField: (field) => set((state) => ({ fields: [...state.fields, field] })),
  updateField: (id, updates) => set((state) => ({
    fields: state.fields.map(f => f.id === id ? { ...f, ...updates } : f)
  })),
  removeField: (id) => set((state) => ({ fields: state.fields.filter(f => f.id !== id) })),
}));
"""
}

def ensure_dir(filepath):
    os.makedirs(os.path.dirname(filepath), exist_ok=True)

for filepath, content in files.items():
    ensure_dir(filepath)
    with open(filepath, "w") as f:
        f.write(content)
    print(f"Wrote {filepath}")
