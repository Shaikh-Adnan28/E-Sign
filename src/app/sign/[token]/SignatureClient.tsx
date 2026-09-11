'use client';
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
