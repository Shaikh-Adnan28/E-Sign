"use client";

import { useState, useEffect, useRef } from "react";
import { Search, UserCheck, Users, Plus, X, Clock, Building, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { Contact } from "@/lib/db/schema";

export interface SelectedRecipient {
  name: string;
  email: string;
  contactId?: string;
  company?: string;
}

interface RecipientPickerProps {
  value: SelectedRecipient | null;
  onChange: (recipient: SelectedRecipient | null) => void;
  placeholder?: string;
  allowGroupSelection?: boolean;
  onGroupSelected?: (members: Contact[]) => void;
  className?: string;
}

export function RecipientPicker({
  value,
  onChange,
  placeholder = "Search contact or enter email...",
  allowGroupSelection = false,
  onGroupSelected,
  className = "",
}: RecipientPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"contacts" | "groups" | "custom">("contacts");
  const [query, setQuery] = useState("");
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [groups, setContactGroups] = useState<Array<{ id: string; name: string; members: Contact[]; memberCount: number }>>([]);
  const [loading, setLoading] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customEmail, setCustomEmail] = useState("");
  const [saveAsContact, setSaveAsContact] = useState(true);

  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch contacts matching search
  useEffect(() => {
    if (!isOpen) return;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    const params = new URLSearchParams({ limit: "30" });
    if (query.trim()) params.set("search", query.trim());

    fetch(`/api/contacts?${params.toString()}`)
      .then((res) => (res.ok ? res.json() : { data: [] }))
      .then((json) => setContacts(json.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isOpen, query]);

  // Fetch groups if enabled
  useEffect(() => {
    if (!isOpen || !allowGroupSelection) return;
    fetch("/api/contact-groups")
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setContactGroups(data || []))
      .catch(() => {});
  }, [isOpen, allowGroupSelection]);

  function handleSelectContact(contact: Contact) {
    onChange({
      name: contact.name,
      email: contact.email,
      contactId: contact.id,
      company: contact.company || undefined,
    });
    // Trigger usage counter update
    fetch(`/api/contacts/${contact.id}/used`, { method: "POST" }).catch(() => {});
    setIsOpen(false);
  }

  function handleSelectGroup(groupMembers: Contact[]) {
    if (onGroupSelected) {
      onGroupSelected(groupMembers);
    }
    setIsOpen(false);
  }

  async function handleAddCustomRecipient(e: React.FormEvent) {
    e.preventDefault();
    if (!customEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customEmail.trim())) return;

    let contactId: string | undefined = undefined;

    if (saveAsContact) {
      try {
        const res = await fetch("/api/contacts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: customName.trim() || customEmail.trim().split("@")[0],
            email: customEmail.trim().toLowerCase(),
          }),
        });
        if (res.ok) {
          const json = await res.json();
          contactId = json.id;
        }
      } catch {
        // continue
      }
    }

    onChange({
      name: customName.trim() || customEmail.trim().split("@")[0],
      email: customEmail.trim().toLowerCase(),
      contactId,
    });

    setCustomName("");
    setCustomEmail("");
    setIsOpen(false);
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Selected Value Box or Input Trigger */}
      {value ? (
        <div className="flex items-center justify-between p-2 px-3 rounded-xl border border-blue-200 bg-blue-50/70 text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-7 w-7 rounded-full bg-[#1A56DB] text-white text-[10px] font-bold flex items-center justify-center shrink-0">
              <UserCheck size={14} />
            </div>
            <div className="min-w-0">
              <p className="font-bold text-slate-900 truncate">{value.name || value.email}</p>
              <p className="text-[10px] text-slate-500 truncate">{value.email}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-slate-400 hover:text-slate-600 p-1 transition-colors"
          >
            <X size={14} />
          </button>
        </div>
      ) : (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <Input
            placeholder={placeholder}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (!isOpen) setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            className="pl-9 h-9 text-xs bg-white"
          />
        </div>
      )}

      {/* Dropdown Popup */}
      {isOpen && !value && (
        <div className="absolute left-0 right-0 top-11 z-30 bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden text-xs">
          {/* Header Tabs */}
          <div className="flex items-center border-b border-slate-100 bg-slate-50/70 p-1 text-[11px] font-semibold text-slate-600">
            <button
              type="button"
              onClick={() => setActiveTab("contacts")}
              className={`flex-1 py-1 rounded-md transition-all ${
                activeTab === "contacts" ? "bg-white text-[#1A56DB] shadow-2xs font-bold" : "hover:text-slate-900"
              }`}
            >
              Contacts ({contacts.length})
            </button>
            {allowGroupSelection && (
              <button
                type="button"
                onClick={() => setActiveTab("groups")}
                className={`flex-1 py-1 rounded-md transition-all ${
                  activeTab === "groups" ? "bg-white text-[#1A56DB] shadow-2xs font-bold" : "hover:text-slate-900"
                }`}
              >
                Groups ({groups.length})
              </button>
            )}
            <button
              type="button"
              onClick={() => setActiveTab("custom")}
              className={`flex-1 py-1 rounded-md transition-all ${
                activeTab === "custom" ? "bg-white text-[#1A56DB] shadow-2xs font-bold" : "hover:text-slate-900"
              }`}
            >
              + New Email
            </button>
          </div>

          {/* Tab 1: Contacts List */}
          {activeTab === "contacts" && (
            <div className="max-h-56 overflow-y-auto p-1 divide-y divide-slate-50">
              {loading ? (
                <div className="p-4 text-center text-slate-400 text-xs">Loading contacts...</div>
              ) : contacts.length === 0 ? (
                <div className="p-4 text-center space-y-2">
                  <p className="text-slate-500 text-xs">No contacts match &ldquo;{query}&rdquo;</p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setActiveTab("custom")}
                    className="h-7 text-xs text-[#1A56DB]"
                  >
                    <Plus size={12} className="mr-1" /> Add New Recipient
                  </Button>
                </div>
              ) : (
                contacts.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => handleSelectContact(c)}
                    className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-blue-50/70 text-left transition-colors"
                  >
                    <div className="min-w-0 pr-2">
                      <div className="font-bold text-slate-900 truncate flex items-center gap-1.5">
                        {c.name}
                        {c.company && (
                          <span className="text-[10px] text-slate-400 font-normal flex items-center gap-0.5">
                            <Building size={10} /> {c.company}
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-500 truncate">{c.email}</div>
                    </div>
                    {c.usageCount > 0 && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 shrink-0 flex items-center gap-0.5">
                        <Clock size={9} /> Used {c.usageCount}x
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>
          )}

          {/* Tab 2: Groups List */}
          {activeTab === "groups" && allowGroupSelection && (
            <div className="max-h-56 overflow-y-auto p-1 space-y-1">
              {groups.length === 0 ? (
                <div className="p-4 text-center text-slate-400 text-xs">No recipient groups available.</div>
              ) : (
                groups.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => handleSelectGroup(g.members)}
                    className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-purple-50 text-left transition-colors border border-slate-100"
                  >
                    <div>
                      <div className="font-bold text-slate-900 flex items-center gap-1.5">
                        <Users size={12} className="text-purple-600" /> {g.name}
                      </div>
                      <div className="text-[10px] text-slate-500">{g.memberCount} members</div>
                    </div>
                    <span className="text-[10px] font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full">
                      Add All ({g.memberCount})
                    </span>
                  </button>
                ))
              )}
            </div>
          )}

          {/* Tab 3: Custom New Recipient */}
          {activeTab === "custom" && (
            <form onSubmit={handleAddCustomRecipient} className="p-3 space-y-2.5">
              <div className="space-y-1">
                <Input
                  placeholder="Recipient Name (e.g. Jane Doe)"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Input
                  type="email"
                  placeholder="Recipient Email Address *"
                  value={customEmail}
                  onChange={(e) => setCustomEmail(e.target.value)}
                  className="h-8 text-xs"
                  required
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="save-contact"
                  checked={saveAsContact}
                  onChange={(e) => setSaveAsContact(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <label htmlFor="save-contact" className="text-[11px] font-medium text-slate-600 cursor-pointer select-none">
                  Save to address book for future use
                </label>
              </div>

              <Button
                type="submit"
                size="sm"
                className="w-full h-8 text-xs font-semibold bg-[#1A56DB] hover:bg-blue-700 text-white"
              >
                <Check size={13} className="mr-1" /> Use Recipient
              </Button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
