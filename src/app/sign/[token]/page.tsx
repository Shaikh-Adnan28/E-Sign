import { db } from "@/lib/db";
import { signers, envelopes, documents, signatureFields } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { notFound } from "next/navigation";
import SignatureClient from "./SignatureClient";

export default async function SignPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  // Find signer by token (no auth, token is the secret)
  const [signer] = await db
    .select()
    .from(signers)
    .where(eq(signers.token, token))
    .limit(1);

  if (!signer) return notFound();

  const [envelope] = await db
    .select()
    .from(envelopes)
    .where(eq(envelopes.id, signer.envelopeId))
    .limit(1);

  if (!envelope) return notFound();

  // Must be in a signable state
  if (!["SENT", "DELIVERED", "VIEWED"].includes(envelope.status)) {
    return notFound();
  }

  const [doc] = await db
    .select()
    .from(documents)
    .where(eq(documents.envelopeId, envelope.id))
    .limit(1);

  if (!doc) return notFound();

  const fields = await db
    .select()
    .from(signatureFields)
    .where(
      and(
        eq(signatureFields.documentId, doc.id),
        eq(signatureFields.signerId, signer.id)
      )
    );

  return (
    <SignatureClient
      token={token}
      signer={{
        id: signer.id,
        name: signer.name,
        email: signer.email,
        status: signer.status ?? "PENDING",
      }}
      envelope={{
        id: envelope.id,
        title: envelope.title,
        message: envelope.message,
      }}
      document={{
        id: doc.id,
        filename: doc.filename,
        pageCount: doc.pageCount ?? 1,
      }}
      fields={fields.map((f) => ({
        id: f.id,
        type: f.type as "SIGNATURE" | "INITIALS" | "TEXT" | "DATE" | "CHECKBOX",
        pageNumber: f.pageNumber,
        x: Number(f.x),
        y: Number(f.y),
        width: Number(f.width),
        height: Number(f.height),
        required: f.required ?? true,
        value: f.value ?? null,
      }))}
    />
  );
}



