import os

frontends = {
    "src/app/dashboard/editor/[id]/page.tsx": """import EditorClient from './EditorClient';
import { db } from '@/lib/db';
import { envelopes, documents, signatureFields, signers } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { auth } from '@/lib/auth';

export default async function EditorPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return notFound();
  
  const { id } = await params;
  
  const [envelope] = await db.select().from(envelopes).where(eq(envelopes.id, id));
  if (!envelope || envelope.ownerId !== session.user.id) return notFound();
  
  const envelopeSigners = await db.select().from(signers).where(eq(signers.envelopeId, id));
  const envelopeDocuments = await db.select().from(documents).where(eq(documents.envelopeId, id));
  
  if (!envelopeDocuments.length) return notFound();
  
  return <EditorClient envelope={envelope} signers={envelopeSigners} documents={envelopeDocuments} />;
}
""",

    "src/app/dashboard/editor/[id]/EditorClient.tsx": """'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function EditorClient({ envelope, signers, documents }: any) {
  const router = useRouter();
  
  const handleSend = async () => {
    await fetch(`/api/envelopes/${envelope.id}/send`, { method: 'POST' });
    router.push('/dashboard');
  };
  
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Editor for {envelope.title}</h1>
      <p>Documents: {documents.length}</p>
      <p>Signers: {signers.length}</p>
      <button onClick={handleSend} className="mt-4 bg-blue-500 text-white px-4 py-2 rounded">
        Send Envelope
      </button>
    </div>
  );
}
""",

    "src/app/sign/[token]/page.tsx": """import { db } from '@/lib/db';
import { signers, envelopes, documents } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import SignatureClient from './SignatureClient';

export default async function SignPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  
  const [signer] = await db.select().from(signers).where(eq(signers.token, token));
  if (!signer) return notFound();
  
  const [envelope] = await db.select().from(envelopes).where(eq(envelopes.id, signer.envelopeId));
  const envelopeDocuments = await db.select().from(documents).where(eq(documents.envelopeId, envelope.id));
  
  return <SignatureClient signer={signer} envelope={envelope} documents={envelopeDocuments} />;
}
""",

    "src/app/sign/[token]/SignatureClient.tsx": """'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { SignatureModal } from '@/components/signing/signature-modal';

export default function SignatureClient({ signer, envelope, documents }: any) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  
  const handleSign = async () => {
    await fetch(`/api/sign/${signer.token}`, {
      method: 'POST',
      body: JSON.stringify({ fields: [] }),
    });
    router.push('/success');
  };
  
  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Sign Document: {envelope.title}</h1>
      <p>Welcome, {signer.name || signer.email}</p>
      <button onClick={() => setIsOpen(true)} className="mt-4 bg-green-500 text-white px-4 py-2 rounded">
        Sign Now
      </button>
      
      {isOpen && (
        <SignatureModal onClose={() => setIsOpen(false)} onSign={handleSign} />
      )}
    </div>
  );
}
""",

    "src/components/signing/signature-modal.tsx": """'use client';

export function SignatureModal({ onClose, onSign }: { onClose: () => void, onSign: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
      <div className="bg-white p-6 rounded-lg w-96">
        <h2 className="text-xl font-bold mb-4">Draw your signature</h2>
        <div className="h-40 border-2 border-dashed border-gray-300 mb-4 bg-gray-50 flex items-center justify-center">
          [Canvas Placeholder]
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-gray-600">Cancel</button>
          <button onClick={onSign} className="px-4 py-2 bg-blue-500 text-white rounded">Adopt & Sign</button>
        </div>
      </div>
    </div>
  );
}
"""
}

def ensure_dir(filepath):
    os.makedirs(os.path.dirname(filepath), exist_ok=True)

for filepath, content in frontends.items():
    ensure_dir(filepath)
    with open(filepath, "w") as f:
        f.write(content)
    print(f"Wrote {filepath}")
