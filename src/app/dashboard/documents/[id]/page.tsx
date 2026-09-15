import { auth } from "@/lib/auth"
import { redirect, notFound } from "next/navigation"
import { db } from "@/lib/db"
import { envelopes, documents, signers, auditEvents } from "@/lib/db/schema"
import { and, eq, desc } from "drizzle-orm"
import { DocumentDetailClient } from "@/components/documents/document-detail-client"
import { MOCK_ENVELOPES, MOCK_ACTIVITIES } from "@/lib/mock-dashboard-data"

export interface EnvelopeDetail {
  id: string
  title: string
  status: string
  message: string | null
  expiresAt: Date | null
  reminderEnabled: boolean
  reminderFirstAfterDays: number | null
  reminderEveryDays: number | null
  reminderMessage: string | null
  nextReminderAt: Date | null
  lastReminderAt: Date | null
  expirationWarningDays: number | null
  createdAt: Date | null
  updatedAt: Date | null
  documents: {
    id: string
    filename: string
    storageKey: string
    pageCount: number | null
    createdAt: Date | null
  }[]
  signers: {
    id: string
    name: string | null
    email: string
    status: string | null
    order: number | null
    signedAt: Date | null
    viewedAt: Date | null
  }[]
  auditEvents: {
    id: string
    event: string
    actor: string | null
    meta: unknown
    ip: string | null
    createdAt: Date | null
  }[]
}

export default async function DocumentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const { id } = await params

  let detail: EnvelopeDetail | null = null

  try {
    const [envelope] = await db
      .select()
      .from(envelopes)
      .where(and(eq(envelopes.id, id), eq(envelopes.ownerId, session.user.id)))
      .limit(1)

    if (!envelope) {
      // Dev mock fallback if mock ID requested or previewing
      if (id.startsWith("mock-env-") || process.env.NODE_ENV !== "production") {
        const mockItem = MOCK_ENVELOPES.find((m) => m.id === id) || MOCK_ENVELOPES[0]
        detail = {
          id: mockItem.id,
          title: mockItem.title,
          status: mockItem.status,
          message: "Please sign this agreement.",
          expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
          reminderEnabled: true,
          reminderFirstAfterDays: 2,
          reminderEveryDays: 3,
          reminderMessage: null,
          nextReminderAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 2),
          lastReminderAt: null,
          expirationWarningDays: 3,
          createdAt: mockItem.createdAt,
          updatedAt: mockItem.createdAt,
          documents: [
            {
              id: "doc-1",
              filename: mockItem.filename || "agreement.pdf",
              storageKey: "mock-key",
              pageCount: 3,
              createdAt: mockItem.createdAt,
            },
          ],
          signers: mockItem.signers.map((s, idx) => ({
            id: `signer-${idx}`,
            name: s.name,
            email: s.email,
            status: s.status,
            order: idx + 1,
            signedAt: s.status === "SIGNED" ? new Date() : null,
            viewedAt: s.status === "VIEWED" ? new Date() : null,
          })),
          auditEvents: MOCK_ACTIVITIES.map((a) => ({
            id: a.id,
            event: a.event,
            actor: a.actor,
            meta: null,
            ip: "192.168.1.1",
            createdAt: a.createdAt,
          })),
        }
      }
    } else {
      const [envelopeDocuments, envelopeSigners, events] = await Promise.all([
        db.select().from(documents).where(eq(documents.envelopeId, id)),
        db
          .select()
          .from(signers)
          .where(eq(signers.envelopeId, id))
          .orderBy(signers.order),
        db
          .select()
          .from(auditEvents)
          .where(eq(auditEvents.envelopeId, id))
          .orderBy(desc(auditEvents.createdAt)),
      ])

      detail = {
        id: envelope.id,
        title: envelope.title,
        status: envelope.status,
        message: envelope.message ?? null,
        expiresAt: envelope.expiresAt ?? null,
        reminderEnabled: envelope.reminderEnabled ?? false,
        reminderFirstAfterDays: envelope.reminderFirstAfterDays ?? 2,
        reminderEveryDays: envelope.reminderEveryDays ?? 3,
        reminderMessage: envelope.reminderMessage ?? null,
        nextReminderAt: envelope.nextReminderAt ?? null,
        lastReminderAt: envelope.lastReminderAt ?? null,
        expirationWarningDays: envelope.expirationWarningDays ?? 3,
        createdAt: envelope.createdAt ?? null,
        updatedAt: envelope.updatedAt ?? null,
        documents: envelopeDocuments.map((d) => ({
          id: d.id,
          filename: d.filename,
          storageKey: d.storageKey,
          pageCount: d.pageCount ?? null,
          createdAt: d.createdAt ?? null,
        })),
        signers: envelopeSigners.map((s) => ({
          id: s.id,
          name: s.name ?? null,
          email: s.email,
          status: s.status ?? null,
          order: s.order ?? null,
          signedAt: s.signedAt ?? null,
          viewedAt: s.viewedAt ?? null,
        })),
        auditEvents: events.map((e) => ({
          id: e.id,
          event: e.event,
          actor: e.actor ?? null,
          meta: e.meta,
          ip: e.ip ?? null,
          createdAt: e.createdAt ?? null,
        })),
      }
    }
  } catch {
    notFound()
  }

  if (!detail) {
    notFound()
  }

  return <DocumentDetailClient envelope={detail} />
}
