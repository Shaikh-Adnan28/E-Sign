'use client';
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
