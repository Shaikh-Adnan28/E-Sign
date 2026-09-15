"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  FileText,
  Clock,
  User,
  Mail,
  ExternalLink,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface SubmissionItem {
  id: string;
  status: string;
  submittedAt: string;
  envelopeId: string | null;
  envelopeTitle: string | null;
  envelopeStatus: string | null;
  signerName: string | null;
  signerEmail: string | null;
}

interface FormDetail {
  id: string;
  name: string;
  description: string | null;
  token: string;
  status: string;
  submissionsCount: number;
  templateName: string;
}

interface FormSubmissionsClientProps {
  formId: string;
}

export function FormSubmissionsClient({ formId }: FormSubmissionsClientProps) {
  const [form, setForm] = useState<FormDetail | null>(null);
  const [submissions, setSubmissions] = useState<SubmissionItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [formRes, subRes] = await Promise.all([
        fetch(`/api/public-forms/${formId}`),
        fetch(`/api/public-forms/${formId}/submissions`),
      ]);

      const formData = await formRes.json();
      const subData = await subRes.json();

      if (formData.form) setForm(formData.form);
      if (subData.submissions) setSubmissions(subData.submissions);
    } catch (err) {
      console.error("Failed to load submissions:", err);
    } finally {
      setLoading(false);
    }
  }, [formId]);

  useEffect(() => {
    let ignore = false;
    async function loadData() {
      const [formRes, subRes] = await Promise.all([
        fetch(`/api/public-forms/${formId}`),
        fetch(`/api/public-forms/${formId}/submissions`),
      ]);

      const formData = await formRes.json();
      const subData = await subRes.json();

      if (!ignore) {
        if (formData.form) setForm(formData.form);
        if (subData.submissions) setSubmissions(subData.submissions);
        setLoading(false);
      }
    }

    loadData();

    return () => {
      ignore = true;
    };
  }, [formId]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 py-8">
      {/* Back Link */}
      <Link
        href="/dashboard/public-forms"
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Public Forms
      </Link>

      {/* Header Info Banner */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-slate-900">
              {form?.name || "Form Submissions"}
            </h1>
            {form && (
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                {form.status}
              </span>
            )}
          </div>
          {form && (
            <p className="text-slate-600 text-sm">
              Source Template: <span className="font-semibold text-slate-800">{form.templateName}</span> • Total Submissions: <span className="font-semibold text-slate-800">{submissions.length}</span>
            </p>
          )}
        </div>

        <Button
          onClick={fetchData}
          variant="outline"
          size="sm"
          className="border-slate-300 text-slate-700 hover:bg-slate-50 gap-2 self-start md:self-auto"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh Data
        </Button>
      </div>

      {/* Submissions Table / List */}
      {loading ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-500">
          Loading submissions...
        </div>
      ) : submissions.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
            <FileText className="h-6 w-6" />
          </div>
          <h3 className="text-base font-semibold text-slate-900">No submissions yet</h3>
          <p className="text-slate-500 text-sm max-w-sm mx-auto">
            When users fill out and submit this public form, their records and signed documents will appear here.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-700 border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="px-6 py-3.5">Signer Name / Email</th>
                  <th className="px-6 py-3.5">Submitted At</th>
                  <th className="px-6 py-3.5">Envelope Title</th>
                  <th className="px-6 py-3.5">Signing Status</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {submissions.map((sub) => {
                  const envStatus = sub.envelopeStatus || "UNKNOWN";
                  const isCompleted = envStatus === "COMPLETED";
                  const isDeclined = envStatus === "DECLINED";

                  return (
                    <tr key={sub.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-6 py-4">
                        <div className="space-y-0.5">
                          <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                            <User className="h-3.5 w-3.5 text-slate-400" />
                            <span>{sub.signerName || "Anonymous Signer"}</span>
                          </div>
                          <div className="text-xs text-slate-500 flex items-center gap-1.5">
                            <Mail className="h-3.5 w-3.5 text-slate-400" />
                            <span>{sub.signerEmail || "No Email"}</span>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap text-slate-600 text-xs">
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 text-slate-400" />
                          <span>
                            {sub.submittedAt
                              ? new Date(sub.submittedAt).toLocaleString()
                              : "N/A"}
                          </span>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <span className="font-medium text-slate-800 line-clamp-1">
                          {sub.envelopeTitle || "Untitled Envelope"}
                        </span>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${
                            isCompleted
                              ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                              : isDeclined
                              ? "bg-red-100 text-red-800 border border-red-300"
                              : "bg-blue-100 text-blue-800 border border-blue-300"
                          }`}
                        >
                          {isCompleted ? (
                            <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                          ) : isDeclined ? (
                            <XCircle className="h-3 w-3 text-red-600" />
                          ) : (
                            <AlertCircle className="h-3 w-3 text-blue-600" />
                          )}
                          {envStatus}
                        </span>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        {sub.envelopeId ? (
                          <Link
                            href={`/dashboard/documents/${sub.envelopeId}`}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors"
                          >
                            <span>View Envelope</span>
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Link>
                        ) : (
                          <span className="text-xs text-slate-400">N/A</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
