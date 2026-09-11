import { XCircle } from "lucide-react";

export default function SigningDeclinedPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-rose-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl p-10 max-w-md w-full text-center">
        <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <XCircle size={40} className="text-red-400" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Signing Declined</h1>
        <p className="text-slate-500 mb-6">
          You have declined to sign this document. The sender has been notified.
        </p>
        <p className="text-xs text-slate-400">You can safely close this window.</p>
      </div>
    </div>
  );
}

