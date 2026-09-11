import { NextRequest } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { envelopes, documents } from "@/lib/db/schema"
import { storageProvider } from "@/lib/storage"
import { and, eq } from "drizzle-orm"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return new Response("Unauthorized", { status: 401 })
    }

    const { id } = await params

    // Fetch document record and verify owner via envelope
    const [doc] = await db
      .select({
        id: documents.id,
        storageKey: documents.storageKey,
        filename: documents.filename,
        ownerId: envelopes.ownerId,
      })
      .from(documents)
      .innerJoin(envelopes, eq(documents.envelopeId, envelopes.id))
      .where(and(eq(documents.id, id), eq(envelopes.ownerId, session.user.id)))
      .limit(1)

    if (!doc) {
      return new Response("Document not found", { status: 404 })
    }

    const fileExists = await storageProvider.exists(doc.storageKey)
    if (!fileExists) {
      return new Response("File not found in storage", { status: 404 })
    }

    const fileBuffer = await storageProvider.download(doc.storageKey)

    return new Response(new Uint8Array(fileBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${encodeURIComponent(doc.filename)}"`,
        "Cache-Control": "private, max-age=3600",
      },
    })
  } catch (error) {
    console.error("[GET_DOCUMENT_FILE_ERROR]", error)
    return new Response("Failed to retrieve document file", { status: 500 })
  }
}
