import { CheckCircle } from "lucide-react";

export default function SigningDonePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl p-10 max-w-md w-full text-center">
        <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle size={40} className="text-emerald-500" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Document Signed!</h1>
        <p className="text-slate-500 mb-6">
          Thank you. Your signature has been recorded and all parties will be notified.
        </p>
        <p className="text-xs text-slate-400">
          You can safely close this window.
        </p>
      </div>
    </div>
  );
}

