"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Mail, Phone, Building2, Tag, Clock, Send, FileText, Pencil, Trash2, History, Loader2 } from "lucide-react";
import { getInitials } from "@/lib/utils";
import type { Contact } from "@/lib/db/schema";

interface ContactDetailModalProps {
  contact: Contact | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (contact: Contact) => void;
  onDelete: (contact: Contact) => void;
}

interface ActivityItem {
  id: string;
  envelopeId: string;
  envelopeTitle: string;
  event: string;
  createdAt: string | null;
}

export function ContactDetailModal({
  contact,
  open,
  onOpenChange,
  onEdit,
  onDelete,
}: ContactDetailModalProps) {
  const router = useRouter();
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loadingActivity, setLoadingActivity] = useState(false);

  useEffect(() => {
    if (!contact || !open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoadingActivity(true);
    fetch(`/api/contacts/${contact.id}/activity`)
      .then((res) => (res.ok ? res.json() : { events: [] }))
      .then((data) => setActivities(data.events || []))
      .catch(() => setActivities([]))
      .finally(() => setLoadingActivity(false));
  }, [contact, open]);

  if (!contact) return null;

  const initials = getInitials(contact.name);

  const handleSendDocument = () => {
    onOpenChange(false);
    router.push(`/dashboard/send?email=${encodeURIComponent(contact.email)}&name=${encodeURIComponent(contact.name)}`);
  };

  const handleUseTemplate = () => {
    onOpenChange(false);
    router.push("/dashboard/templates");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-[#1A56DB] text-white flex items-center justify-center text-lg font-bold">
              {initials}
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-slate-900">{contact.name}</DialogTitle>
              <DialogDescription className="text-xs text-slate-500">{contact.email}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Quick Actions Row */}
          <div className="flex flex-wrap items-center gap-2 pb-3 border-b border-slate-100">
            <Button
              size="sm"
              onClick={handleSendDocument}
              className="h-8 text-xs font-semibold bg-[#1A56DB] hover:bg-blue-700 text-white gap-1.5"
            >
              <Send size={13} /> Send Document
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleUseTemplate}
              className="h-8 text-xs font-semibold gap-1.5"
            >
              <FileText size={13} /> Use Template
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                onOpenChange(false);
                onEdit(contact);
              }}
              className="h-8 text-xs gap-1.5 text-slate-600 hover:text-slate-900"
            >
              <Pencil size={13} /> Edit
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                onOpenChange(false);
                onDelete(contact);
              }}
              className="h-8 text-xs gap-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 ml-auto"
            >
              <Trash2 size={13} /> Delete
            </Button>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 text-xs">
            <div className="space-y-1">
              <p className="text-[10px] font-semibold text-slate-400 uppercase">Email Address</p>
              <p className="font-medium text-slate-800 flex items-center gap-1.5 truncate">
                <Mail size={12} className="text-slate-400" /> {contact.email}
              </p>
            </div>

            {contact.phone && (
              <div className="space-y-1">
                <p className="text-[10px] font-semibold text-slate-400 uppercase">Phone Number</p>
                <p className="font-medium text-slate-800 flex items-center gap-1.5">
                  <Phone size={12} className="text-slate-400" /> {contact.phone}
                </p>
              </div>
            )}

            {contact.company && (
              <div className="space-y-1">
                <p className="text-[10px] font-semibold text-slate-400 uppercase">Company / Org</p>
                <p className="font-medium text-slate-800 flex items-center gap-1.5 truncate">
                  <Building2 size={12} className="text-slate-400" /> {contact.company}
                </p>
              </div>
            )}

            <div className="space-y-1">
              <p className="text-[10px] font-semibold text-slate-400 uppercase">Usage Statistics</p>
              <p className="font-medium text-slate-800 flex items-center gap-1.5">
                <Clock size={12} className="text-blue-600" /> Used {contact.usageCount} time{contact.usageCount === 1 ? "" : "s"}
                {contact.lastUsedAt && (
                  <span className="text-[10px] text-slate-400">
                    ({new Date(contact.lastUsedAt).toLocaleDateString()})
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Tags */}
          {contact.tags && contact.tags.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[11px] font-bold text-slate-700 uppercase tracking-wide">Tags</p>
              <div className="flex flex-wrap gap-1.5">
                {contact.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-[#1A56DB] border border-blue-200"
                  >
                    <Tag size={11} /> {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          {contact.notes && (
            <div className="space-y-1">
              <p className="text-[11px] font-bold text-slate-700 uppercase tracking-wide">Notes</p>
              <p className="text-xs text-slate-600 bg-white p-3 rounded-lg border border-slate-200 italic">
                {contact.notes}
              </p>
            </div>
          )}

          {/* Activity History */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <p className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <History size={14} className="text-[#1A56DB]" /> Recent Envelope Activity
            </p>

            {loadingActivity ? (
              <div className="py-6 text-center text-xs text-slate-400">
                <Loader2 className="h-4 w-4 animate-spin mx-auto mb-1 text-blue-600" />
                Loading timeline...
              </div>
            ) : activities.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-2">
                No recorded signing events for this contact email yet.
              </p>
            ) : (
              <div className="space-y-2 max-h-40 overflow-y-auto pl-2 border-l-2 border-slate-200">
                {activities.map((act) => (
                  <div key={act.id} className="text-xs space-y-0.5 relative pl-2">
                    <div className="absolute -left-[13px] top-1.5 h-2 w-2 rounded-full bg-blue-500" />
                    <p className="font-bold text-slate-800">
                      {act.event.replace(/_/g, " ")} — <span className="font-normal text-slate-600">{act.envelopeTitle}</span>
                    </p>
                    {act.createdAt && (
                      <p className="text-[10px] text-slate-400">{new Date(act.createdAt).toLocaleString()}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
