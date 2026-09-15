import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { envelopes, documents, auditEvents } from "@/lib/db/schema"
import { storageProvider } from "@/lib/storage"
import { getPdfPageCount } from "@/lib/pdf-utils"
import { eq } from "drizzle-orm"

const MAX_FILE_SIZE = 15 * 1024 * 1024 // 15 MB

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // 2. Parse Multipart Form Data
    const formData = await request.formData()
    const file = formData.get("file") as File | null
    const titleInput = formData.get("title") as string | null

    if (!file) {
      return NextResponse.json({ error: "No PDF file provided" }, { status: 400 })
    }

    // 3. Basic File Validation
    const fileName = file.name || "document.pdf"
    if (!fileName.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf") {
      return NextResponse.json(
        { error: "Invalid file format. Only PDF files (.pdf) are allowed." },
        { status: 400 }
      )
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File size exceeds the 15 MB limit." },
        { status: 400 }
      )
    }

    if (file.size === 0) {
      return NextResponse.json(
        { error: "Uploaded file is empty (0 bytes)." },
        { status: 400 }
      )
    }

    // 4. Read File Bytes & Validate Magic Header
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Check PDF Magic Header (%PDF)
    if (buffer.length < 4 || buffer.toString("utf8", 0, 4) !== "%PDF") {
      return NextResponse.json(
        { error: "Invalid PDF file: Missing or invalid PDF header." },
        { status: 400 }
      )
    }

    // 5. Parse PDF Page Count & Verify Structure
    let pageCount = 0
    try {
      pageCount = await getPdfPageCount(buffer)
    } catch (parseError: unknown) {
      const msg = parseError instanceof Error ? parseError.message : "Failed to parse PDF document structure."
      return NextResponse.json(
        { error: msg },
        { status: 400 }
      )
    }

    // Determine document title
    const docTitle =
      titleInput?.trim() ||
      fileName.replace(/\.pdf$/i, "").trim() ||
      "Untitled Document"

    // 6. DB Record Creation with Cleanup Protection
    let createdEnvelopeId: string | null = null
    let storageKeyCreated: string | null = null

    try {
      // Step A: Create Envelope Record
      const [envelope] = await db
        .insert(envelopes)
        .values({
          ownerId: session.user.id,
          title: docTitle,
          status: "DRAFT",
        })
        .returning()

      createdEnvelopeId = envelope.id

      // Step B: Create Document Record
      const [docRecord] = await db
        .insert(documents)
        .values({
          envelopeId: envelope.id,
          filename: fileName,
          storageKey: `documents/temp/placeholder.pdf`,
          pageCount,
        })
        .returning()

      const finalStorageKey = `documents/${docRecord.id}/original.pdf`

      // Step C: Upload File to Private Local Storage
      await storageProvider.upload(buffer, finalStorageKey)
      storageKeyCreated = finalStorageKey

      // Step D: Update Document Storage Key
      await db
        .update(documents)
        .set({ storageKey: finalStorageKey })
        .where(eq(documents.id, docRecord.id))

      // Step E: Create Audit Event Record
      await db.insert(auditEvents).values({
        envelopeId: envelope.id,
        event: "DOCUMENT_CREATED",
        actor: session.user.email || session.user.name || session.user.id,
        meta: {
          documentId: docRecord.id,
          filename: fileName,
          pageCount,
          sizeBytes: file.size,
        },
      })

      return NextResponse.json(
        {
          success: true,
          envelopeId: envelope.id,
          documentId: docRecord.id,
          redirectUrl: `/dashboard/documents/${envelope.id}`,
        },
        { status: 201 }
      )
    } catch (dbStorageError: unknown) {
      // Rollback DB records & Storage on failure
      if (storageKeyCreated) {
        await storageProvider.delete(storageKeyCreated).catch(() => {})
      }
      if (createdEnvelopeId) {
        await db
          .delete(envelopes)
          .where(eq(envelopes.id, createdEnvelopeId))
          .catch(() => {})
      }

      console.error("[UPLOAD_API_ERROR]", dbStorageError)
      return NextResponse.json(
        { error: "Failed to store document. Cleaned up partial uploads." },
        { status: 500 }
      )
    }
  } catch (error: unknown) {
    console.error("[UPLOAD_ROUTE_CRITICAL_ERROR]", error)
    return NextResponse.json(
      { error: "An internal server error occurred." },
      { status: 500 }
    )
  }
}