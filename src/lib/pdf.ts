import { PDFDocument, rgb } from 'pdf-lib';
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
