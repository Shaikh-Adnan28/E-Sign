import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { envelopes, documents, signatureFields, signers } from "@/lib/db/schema";
import { eq, and, asc } from "drizzle-orm";
import EditorClient from "./EditorClient";

export default async function EditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/login");

  const { id } = await params;

  const [envelope] = await db
    .select()
    .from(envelopes)
    .where(and(eq(envelopes.id, id), eq(envelopes.ownerId, session.user.id)))
    .limit(1);

  if (!envelope) return notFound();

  const [doc] = await db
    .select()
    .from(documents)
    .where(eq(documents.envelopeId, id))
    .limit(1);

  if (!doc) return notFound();

  const fields = await db
    .select()
    .from(signatureFields)
    .where(eq(signatureFields.documentId, doc.id));

  const envelopeSigners = await db
    .select()
    .from(signers)
    .where(eq(signers.envelopeId, id))
    .orderBy(asc(signers.order));

  const initialFields = fields.map((f) => ({
    id: f.id,
    documentId: f.documentId,
    signerId: f.signerId,
    type: f.type as "SIGNATURE" | "INITIALS" | "TEXT" | "DATE" | "CHECKBOX",
    pageNumber: f.pageNumber,
    x: Number(f.x),
    y: Number(f.y),
    width: Number(f.width),
    height: Number(f.height),
    required: f.required ?? true,
    value: f.value,
  }));

  return (
    <EditorClient
      envelopeId={id}
      envelopeTitle={envelope.title}
      documentId={doc.id}
      pageCount={doc.pageCount ?? 1}
      initialFields={initialFields}
      signers={envelopeSigners.map((s) => ({
        id: s.id,
        name: s.name,
        email: s.email,
        order: s.order ?? 0,
        status: s.status ?? "PENDING",
      }))}
    />
  );
}

