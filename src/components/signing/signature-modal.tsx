'use client';

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
