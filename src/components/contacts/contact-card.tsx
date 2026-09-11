"use client"

import { Building2, Mail, Phone, MoreHorizontal, Pencil, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { getInitials } from "@/lib/utils"
import type { Contact } from "@/lib/db/schema"

interface ContactCardProps {
  contact: Contact
  onEdit: (contact: Contact) => void
  onDelete: (contact: Contact) => void
}

// Deterministic avatar color based on name
const AVATAR_COLORS = [
  "bg-blue-100 text-blue-700",
  "bg-violet-100 text-violet-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700",
  "bg-rose-100 text-rose-700",
  "bg-cyan-100 text-cyan-700",
  "bg-indigo-100 text-indigo-700",
  "bg-teal-100 text-teal-700",
]

function getAvatarColor(name: string) {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

export function ContactCard({ contact, onEdit, onDelete }: ContactCardProps) {
  const initials = getInitials(contact.name)
  const avatarColor = getAvatarColor(contact.name)

  return (
    <div className="group flex items-start gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-xs transition-all hover:border-slate-300 hover:shadow-sm">
      {/* Avatar */}
      <div
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${avatarColor}`}
      >
        {initials}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1 space-y-1">
        <p className="truncate font-semibold text-slate-900">{contact.name}</p>

        <a
          href={`mailto:${contact.email}`}
          className="flex items-center gap-1.5 truncate text-sm text-slate-500 hover:text-blue-600 transition-colors"
        >
          <Mail className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{contact.email}</span>
        </a>

        {contact.company && (
          <p className="flex items-center gap-1.5 truncate text-sm text-slate-500">
            <Building2 className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{contact.company}</span>
          </p>
        )}

        {contact.phone && (
          <a
            href={`tel:${contact.phone}`}
            className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-blue-600 transition-colors"
          >
            <Phone className="h-3.5 w-3.5 shrink-0" />
            <span>{contact.phone}</span>
          </a>
        )}

        {contact.notes && (
          <p className="mt-1.5 line-clamp-2 text-xs text-slate-400 italic">
            {contact.notes}
          </p>
        )}
      </div>

      {/* Actions */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
            aria-label={`Actions for ${contact.name}`}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuItem onClick={() => onEdit(contact)} className="cursor-pointer">
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => onDelete(contact)}
            className="cursor-pointer text-red-600 focus:text-red-600"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
