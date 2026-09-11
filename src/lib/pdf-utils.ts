import { PDFDocument } from "pdf-lib"

export async function getPdfPageCount(buffer: Buffer): Promise<number> {
  try {
    const pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true })
    const pageCount = pdfDoc.getPageCount()
    if (pageCount < 1) {
      throw new Error("PDF document contains no pages")
    }
    return pageCount
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Parsing failed"
    if (message.includes("encrypted")) {
      throw new Error("Encrypted PDFs are not supported")
    }
    throw new Error(`Invalid or corrupted PDF file: ${message}`)
  }
}
