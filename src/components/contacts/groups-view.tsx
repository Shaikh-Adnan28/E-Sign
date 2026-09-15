"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Users, Plus, Pencil, Trash2, Loader2, Search } from "lucide-react";
import type { Contact } from "@/lib/db/schema";

interface ContactGroupWithMembers {
  id: string;
  name: string;
  description: string | null;
  memberCount: number;
  members: Contact[];
}

export function GroupsView() {
  const [groups, setGroups] = useState<ContactGroupWithMembers[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [allContacts, setAllContacts] = useState<Contact[]>([]);

  // Modals
  const [createOpen, setCreateOpen] = useState(false);
  const [editGroup, setEditGroup] = useState<ContactGroupWithMembers | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ContactGroupWithMembers | null>(null);

  // Form State
  const [groupName, setGroupName] = useState("");
  const [groupDesc, setGroupDesc] = useState("");
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [memberSearch, setMemberSearch] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchGroups = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/contact-groups");
      if (res.ok) {
        const data = await res.json();
        setGroups(data || []);
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchAllContacts = useCallback(async () => {
    try {
      const res = await fetch("/api/contacts?limit=100");
      if (res.ok) {
        const json = await res.json();
        setAllContacts(json.data || []);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchGroups();
    fetchAllContacts();
  }, [fetchGroups, fetchAllContacts]);

  const openCreateModal = () => {
    setGroupName("");
    setGroupDesc("");
    setSelectedContactIds([]);
    setError(null);
    setCreateOpen(true);
  };

  const openEditModal = (group: ContactGroupWithMembers) => {
    setEditGroup(group);
    setGroupName(group.name);
    setGroupDesc(group.description || "");
    setSelectedContactIds(group.members.map((m) => m.id));
    setError(null);
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim()) return;
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/contact-groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: groupName.trim(),
          description: groupDesc.trim() || undefined,
          contactIds: selectedContactIds,
        }),
      });

      if (!res.ok) {
        const j = await res.json();
        setError(j.error || "Failed to create group");
        return;
      }

      setCreateOpen(false);
      fetchGroups();
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editGroup || !groupName.trim()) return;
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/contact-groups/${editGroup.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: groupName.trim(),
          description: groupDesc.trim() || null,
          contactIds: selectedContactIds,
        }),
      });

      if (!res.ok) {
        const j = await res.json();
        setError(j.error || "Failed to update group");
        return;
      }

      setEditGroup(null);
      fetchGroups();
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteGroup = async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`/api/contact-groups/${deleteTarget.id}`, { method: "DELETE" });
      if (res.ok) {
        setDeleteTarget(null);
        fetchGroups();
      }
    } catch {
      // ignore
    }
  };

  const toggleContactSelection = (id: string) => {
    setSelectedContactIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const filteredContactsForModal = allContacts.filter(
    (c) =>
      c.name.toLowerCase().includes(memberSearch.toLowerCase()) ||
      c.email.toLowerCase().includes(memberSearch.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Subheader */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-900">Recipient Groups</h2>
          <p className="text-xs text-slate-500">Group multiple signers to quickly include them in signature requests</p>
        </div>
        <Button onClick={openCreateModal} className="h-9 text-xs bg-[#1A56DB] hover:bg-blue-700 text-white font-semibold">
          <Plus size={14} className="mr-1.5" /> Create Group
        </Button>
      </div>

      {/* Grid of Groups */}
      {isLoading ? (
        <div className="py-12 text-center text-xs text-slate-400">Loading recipient groups...</div>
      ) : groups.length === 0 ? (
        <div className="p-8 rounded-2xl border-2 border-dashed border-slate-200 text-center space-y-3 bg-white">
          <div className="h-12 w-12 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center mx-auto">
            <Users size={24} />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900">No Recipient Groups Yet</p>
            <p className="text-xs text-slate-500">Create your first group (e.g. Executive Board, Vendors) to send to multiple people at once.</p>
          </div>
          <Button onClick={openCreateModal} size="sm" className="h-8 text-xs bg-[#1A56DB] text-white">
            <Plus size={13} className="mr-1" /> Create Group
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {groups.map((group) => (
            <div
              key={group.id}
              className="p-4 rounded-xl border border-slate-200 bg-white shadow-2xs hover:shadow-sm transition-shadow space-y-3 relative group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center font-bold text-xs">
                      <Users size={16} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">{group.name}</h3>
                      <p className="text-[11px] text-purple-700 font-semibold">{group.memberCount} member{group.memberCount === 1 ? "" : "s"}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => openEditModal(group)}
                      className="p-1 text-slate-400 hover:text-blue-600 rounded transition-colors"
                      title="Edit group"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => setDeleteTarget(group)}
                      className="p-1 text-slate-400 hover:text-red-600 rounded transition-colors"
                      title="Delete group"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {group.description && (
                  <p className="text-xs text-slate-500 mt-2 line-clamp-2">{group.description}</p>
                )}

                {/* Member Preview List */}
                <div className="mt-3 pt-3 border-t border-slate-100 space-y-1.5">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Group Members</p>
                  {group.members.length === 0 ? (
                    <p className="text-[11px] text-slate-400 italic">No members in group.</p>
                  ) : (
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {group.members.map((m) => (
                        <div key={m.id} className="flex items-center justify-between text-xs text-slate-700">
                          <span className="truncate font-medium">{m.name}</span>
                          <span className="text-[10px] text-slate-400 truncate ml-2">{m.email}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      <Dialog
        open={createOpen || !!editGroup}
        onOpenChange={(open) => {
          if (!open) {
            setCreateOpen(false);
            setEditGroup(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">
              {editGroup ? `Edit Group: ${editGroup.name}` : "Create Recipient Group"}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Combine contacts into a reusable group for multi-recipient envelopes.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={editGroup ? handleUpdateGroup : handleCreateGroup} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="group-name" className="text-xs font-semibold">Group Name *</Label>
              <Input
                id="group-name"
                placeholder="e.g. Legal Team, Executive Board"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                className="h-9 text-xs"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="group-desc" className="text-xs font-semibold">Description (Optional)</Label>
              <Input
                id="group-desc"
                placeholder="Brief summary of group purpose"
                value={groupDesc}
                onChange={(e) => setGroupDesc(e.target.value)}
                className="h-9 text-xs"
              />
            </div>

            {/* Select Members Section */}
            <div className="space-y-2 pt-1 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">Select Group Members ({selectedContactIds.length})</Label>
              </div>

              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input
                  placeholder="Filter contacts..."
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  className="pl-8 h-8 text-xs bg-slate-50"
                />
              </div>

              <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100 bg-white">
                {filteredContactsForModal.length === 0 ? (
                  <div className="p-3 text-center text-xs text-slate-400">No matching contacts in address book.</div>
                ) : (
                  filteredContactsForModal.map((c) => {
                    const isSelected = selectedContactIds.includes(c.id);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => toggleContactSelection(c.id)}
                        className={`w-full flex items-center justify-between p-2 text-left text-xs transition-colors ${
                          isSelected ? "bg-purple-50/70" : "hover:bg-slate-50"
                        }`}
                      >
                        <div className="min-w-0 pr-2">
                          <p className="font-bold text-slate-900 truncate">{c.name}</p>
                          <p className="text-[10px] text-slate-500 truncate">{c.email}</p>
                        </div>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}} // handled by button click
                          className="h-4 w-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500 cursor-pointer"
                        />
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {error && <p className="text-xs text-red-600 bg-red-50 p-2 rounded-lg border border-red-200">{error}</p>}

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setCreateOpen(false);
                  setEditGroup(null);
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmitting || !groupName.trim()}
                className="bg-[#1A56DB] hover:bg-blue-700 text-white font-semibold"
              >
                {isSubmitting && <Loader2 size={13} className="mr-1.5 animate-spin" />}
                {editGroup ? "Save Group" : "Create Group"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Group Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-red-600">Delete Recipient Group</DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Are you sure you want to delete group &ldquo;{deleteTarget?.name}&rdquo;? Member contacts will remain safe in your address book.
            </DialogDescription>
          </DialogHeader>

          <div className="flex justify-end gap-2 pt-3">
            <Button variant="outline" size="sm" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" size="sm" onClick={handleDeleteGroup}>
              Delete Group
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
