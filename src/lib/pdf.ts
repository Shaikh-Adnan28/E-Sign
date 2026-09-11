import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { storageProvider } from "@/lib/storage";

export interface FieldToStamp {
  type: string;
  pageNumber: number; // 1-based
  x: number; // normalized 0-1
  y: number;
  width: number;
  height: number;
  value: string;
}

/**
 * Loads the original PDF from storage, stamps all completed field values
 * onto the correct pages, saves the completed PDF back to storage, and
 * returns the new storage key.
 */
export async function stampSignedDocument(
  originalStorageKey: string,
  fields: FieldToStamp[]
): Promise<string> {
  const originalBuffer = await storageProvider.download(originalStorageKey);
  const pdfDoc = await PDFDocument.load(originalBuffer);
  const pages = pdfDoc.getPages();

  for (const field of fields) {
    if (!field.value) continue;

    const pageIndex = field.pageNumber - 1;
    if (pageIndex < 0 || pageIndex >= pages.length) continue;

    const page = pages[pageIndex];
    const { width: pageWidth, height: pageHeight } = page.getSize();

    // Convert normalized coords to PDF points (PDF origin = bottom-left)
    const absX = field.x * pageWidth;
    const absW = field.width * pageWidth;
    const absH = field.height * pageHeight;
    // y in our system is top-down (0 = top of page); PDF is bottom-up
    const absY = pageHeight - field.y * pageHeight - absH;

    if (field.type === "SIGNATURE" || field.type === "INITIALS") {
      if (field.value.startsWith("data:image/png;base64,")) {
        const base64 = field.value.slice("data:image/png;base64,".length);
        const imgBytes = Buffer.from(base64, "base64");
        try {
          const img = await pdfDoc.embedPng(imgBytes);
          page.drawImage(img, { x: absX, y: absY, width: absW, height: absH });
        } catch {
          // fallback: draw placeholder text if image is malformed
          const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
          page.drawText("[Signed]", {
            x: absX + 2,
            y: absY + absH / 2 - 6,
            size: 12,
            font,
            color: rgb(0.1, 0.3, 0.9),
          });
        }
      }
    } else if (field.type === "TEXT" || field.type === "DATE") {
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const fontSize = Math.min(11, absH * 0.65);
      page.drawText(field.value, {
        x: absX + 3,
        y: absY + (absH - fontSize) / 2,
        size: fontSize,
        font,
        color: rgb(0, 0, 0),
        maxWidth: absW - 6,
      });
    } else if (field.type === "CHECKBOX") {
      if (field.value === "true") {
        const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        const fontSize = Math.min(absW, absH) * 0.7;
        page.drawText("✓", {
          x: absX + (absW - fontSize * 0.6) / 2,
          y: absY + (absH - fontSize) / 2,
          size: fontSize,
          font,
          color: rgb(0.09, 0.45, 0.94),
        });
      }
    }
  }

  const completedBytes = await pdfDoc.save();
  const completedKey = originalStorageKey.replace(
    "/original.pdf",
    "/completed.pdf"
  );
  await storageProvider.upload(Buffer.from(completedBytes), completedKey);
  return completedKey;
}

