"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import {
  FileSignature,
  ShieldCheck,
  AlertTriangle,
  Clock,
  ArrowRight,
  FileText,
  User,
  Mail,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface TemplateRole {
  id: string;
  roleName: string;
  order: number;
}

interface PublicFormDetail {
  id: string;
  name: string;
  description: string | null;
  token: string;
  status: string;
  confirmationMessage: string | null;
  expiresAt: string | null;
  templateName: string;
  pageCount: number | null;
}

export default function PublicFormPage({
  params,
}: {
  params: Promise<{ publicToken: string }>;
}) {
  const { publicToken } = use(params);
  const router = useRouter();

  const [form, setForm] = useState<PublicFormDetail | null>(null);
  const [roles, setRoles] = useState<TemplateRole[]>([]);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Single role input
  const [signerName, setSignerName] = useState("");
  const [signerEmail, setSignerEmail] = useState("");

  // Multi role inputs (roleId -> { name, email })
  const [roleInputs, setRoleInputs] = useState<Record<string, { name: string; email: string }>>({});

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    async function loadForm() {
      try {
        setLoading(true);
        const res = await fetch(`/api/public/forms/${publicToken}`);
        const data = await res.json();

        if (data.form) {
          setForm(data.form);
        }
        setIsAvailable(data.isAvailable);
        setReason(data.reason);

        if (data.roles && data.roles.length > 0) {
          setRoles(data.roles);
          const initialMap: Record<string, { name: string; email: string }> = {};
          data.roles.forEach((r: TemplateRole) => {
            initialMap[r.id] = { name: "", email: "" };
          });
          setRoleInputs(initialMap);
        }
      } catch (err) {
        console.error("Failed to load public form:", err);
        setIsAvailable(false);
        setReason("NOT_FOUND");
      } finally {
        setLoading(false);
      }
    }

    loadForm();
  }, [publicToken]);

  const handleRoleInputChange = (roleId: string, field: "name" | "email", val: string) => {
    setRoleInputs((prev) => ({
      ...prev,
      [roleId]: {
        ...prev[roleId],
        [field]: val,
      },
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    interface SubmitPayload {
      signerName?: string;
      signerEmail: string;
      roleInputs?: Array<{ roleId: string; name?: string; email: string }>;
    }

    let payload: SubmitPayload;

    if (roles.length > 1) {
      const mapped = roles.map((r) => ({
        roleId: r.id,
        name: roleInputs[r.id]?.name || "",
        email: roleInputs[r.id]?.email || "",
      }));

      // Validate all emails filled
      const missingRole = mapped.find((m) => !m.email.trim());
      if (missingRole) {
        const rName = roles.find((r) => r.id === missingRole.roleId)?.roleName || "Recipient";
        setErrorMsg(`Email address is required for ${rName}`);
        return;
      }

      payload = {
        signerName: mapped[0].name,
        signerEmail: mapped[0].email,
        roleInputs: mapped,
      };
    } else {
      if (!signerEmail.trim()) {
        setErrorMsg("Email address is required");
        return;
      }
      payload = {
        signerName: signerName.trim(),
        signerEmail: signerEmail.trim().toLowerCase(),
      };
    }

    try {
      setSubmitting(true);
      const res = await fetch(`/api/public/forms/${publicToken}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to start signing session");
      }

      if (data.signingToken) {
        // Redirect seamlessly to signing page
        router.push(`/sign/${data.signingToken}`);
      } else {
        throw new Error("Invalid response from server");
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to submit form. Please try again.");
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center space-y-3">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm font-medium text-slate-600">Loading form details...</p>
        </div>
      </div>
    );
  }

  if (!isAvailable) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-between py-12 px-4">
        <div className="max-w-md mx-auto w-full space-y-6">
          <div className="flex justify-center items-center gap-2 text-slate-900 font-bold text-xl">
            <div className="p-2 bg-blue-600 text-white rounded-xl shadow-sm">
              <FileSignature className="h-6 w-6" />
            </div>
            <span>ESign Self-Service</span>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-md p-8 text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-amber-100 text-amber-600 mx-auto flex items-center justify-center">
              {reason === "PAUSED" ? (
                <Clock className="h-7 w-7" />
              ) : reason === "EXPIRED" ? (
                <AlertTriangle className="h-7 w-7" />
              ) : (
                <FileText className="h-7 w-7" />
              )}
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-bold text-slate-900">
                {reason === "PAUSED"
                  ? "Form Currently Paused"
                  : reason === "EXPIRED"
                  ? "Public Link Expired"
                  : reason === "ARCHIVED"
                  ? "Form No Longer Available"
                  : "Form Not Found"}
              </h2>
              <p className="text-slate-600 text-sm">
                {reason === "PAUSED"
                  ? "The owner has temporarily paused this public form. Please check back later or contact the sender."
                  : reason === "EXPIRED"
                  ? "This self-service signing link has expired and is no longer accepting new submissions."
                  : "The link you clicked may be invalid, expired, or removed by the sender."}
              </p>
            </div>
          </div>
        </div>

        <div className="text-center text-xs text-slate-400">
          Powered by <span className="font-semibold text-slate-600">ESign</span> • Secure Document Workflow
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between py-10 px-4">
      <div className="max-w-xl mx-auto w-full space-y-6">
        {/* Brand Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 text-slate-900 font-bold text-xl">
            <div className="p-2 bg-blue-600 text-white rounded-xl shadow-sm">
              <FileSignature className="h-6 w-6" />
            </div>
            <span>ESign</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full font-medium">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
            Verified & Encrypted
          </div>
        </div>

        {/* Main Form Card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-md p-6 sm:p-8 space-y-6">
          <div className="space-y-2 border-b border-slate-100 pb-5">
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              {form?.name}
            </h1>
            {form?.description && (
              <p className="text-sm text-slate-600 leading-relaxed">
                {form.description}
              </p>
            )}
            <div className="flex items-center gap-2 pt-1 text-xs text-slate-500 font-medium">
              <FileText className="h-4 w-4 text-blue-500" />
              <span>Document Template: {form?.templateName}</span>
              {form?.pageCount && <span>• {form.pageCount} page(s)</span>}
            </div>
          </div>

          {errorMsg && (
            <div className="p-3.5 bg-red-50 text-red-700 border border-red-200 rounded-xl text-xs flex items-center gap-2 font-medium">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {roles.length > 1 ? (
              <div className="space-y-5">
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Recipient Information ({roles.length} Roles Required)
                </div>
                {roles.map((role, idx) => (
                  <div
                    key={role.id}
                    className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3"
                  >
                    <div className="font-semibold text-xs text-slate-700 flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5 text-blue-600" />
                      <span>
                        Role #{idx + 1}: {role.roleName}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs text-slate-600">Full Name</Label>
                        <Input
                          value={roleInputs[role.id]?.name || ""}
                          onChange={(e) =>
                            handleRoleInputChange(role.id, "name", e.target.value)
                          }
                          placeholder="Full Name"
                          className="bg-white text-slate-900 border-slate-300"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-slate-600">Email Address *</Label>
                        <Input
                          type="email"
                          value={roleInputs[role.id]?.email || ""}
                          onChange={(e) =>
                            handleRoleInputChange(role.id, "email", e.target.value)
                          }
                          placeholder="email@example.com"
                          required
                          className="bg-white text-slate-900 border-slate-300"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">
                    Your Full Name
                  </Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      value={signerName}
                      onChange={(e) => setSignerName(e.target.value)}
                      placeholder="Jane Doe"
                      className="pl-9 bg-white text-slate-900 border-slate-300 h-10"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-slate-700">
                    Your Email Address *
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      type="email"
                      value={signerEmail}
                      onChange={(e) => setSignerEmail(e.target.value)}
                      placeholder="jane@example.com"
                      required
                      className="pl-9 bg-white text-slate-900 border-slate-300 h-10"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="pt-2">
              <Button
                type="submit"
                disabled={submitting}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm h-11 rounded-xl shadow-md flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Preparing Document...
                  </>
                ) : (
                  <>
                    Proceed to Document & Sign
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </div>

            <div className="flex items-center justify-center gap-1.5 text-xs text-slate-500 pt-1">
              <Lock className="h-3.5 w-3.5 text-slate-400" />
              <span>Signatures are legally binding and audit-trailed</span>
            </div>
          </form>
        </div>
      </div>

      <div className="text-center text-xs text-slate-400 pt-8">
        Powered by <span className="font-semibold text-slate-600">ESign SaaS</span> • Self-Service Signature Engine
      </div>
    </div>
  );
}
