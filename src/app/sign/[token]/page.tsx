import { db } from "@/lib/db";
import { signers, envelopes, documents, signatureFields } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { notFound } from "next/navigation";
import SignatureClient from "./SignatureClient";
import { Clock, ShieldX } from "lucide-react";

export default async function SignPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  // Find signer by token (no auth required, token acts as access key)
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

  const now = new Date();
  const isExpired =
    envelope.status === "EXPIRED" ||
    signer.status === "EXPIRED" ||
    (envelope.expiresAt !== null && envelope.expiresAt <= now);

  if (isExpired) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8 max-w-md w-full text-center space-y-4">
          <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto">
            <Clock size={24} />
          </div>
          <h1 className="text-xl font-bold text-slate-900">Document Expired</h1>
          <p className="text-sm text-slate-600 leading-relaxed">
            The signature request for <strong className="text-slate-800">&ldquo;{envelope.title}&rdquo;</strong> has passed its expiration deadline and is no longer available for signing.
          </p>
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-100 text-xs text-slate-500 text-left">
            <p className="font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
              <ShieldX size={14} className="text-slate-400" /> Security Note
            </p>
            Field interactions and submissions are disabled for expired documents. Please contact the sender if you need a new signature request link.
          </div>
        </div>
      </div>
    );
  }

  // Must be in a signable active state
  if (!["SENT", "DELIVERED", "VIEWED", "PARTIALLY_SIGNED"].includes(envelope.status)) {
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
