"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { ContactForm, type ContactFormData } from "./contact-form"
import type { Contact } from "@/lib/db/schema"

interface AddContactModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: (contact: Contact) => void
}

export function AddContactModal({
  open,
  onOpenChange,
  onSuccess,
}: AddContactModalProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(data: ContactFormData) {
    setIsLoading(true)
    setError(null)
    const tagsArray = data.tags ? data.tags.split(",").map((t) => t.trim()).filter(Boolean) : undefined
    try {
      const res = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name,
          email: data.email,
          company: data.company || undefined,
          phone: data.phone || undefined,
          tags: tagsArray,
          notes: data.notes || undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? "Failed to create contact")
        return
      }
      onSuccess(json as Contact)
      onOpenChange(false)
    } catch {
      setError("Something went wrong. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Contact</DialogTitle>
          <DialogDescription>
            Add a new contact to your address book.
          </DialogDescription>
        </DialogHeader>
        <ContactForm
          onSubmit={handleSubmit}
          submitLabel="Add Contact"
          onCancel={() => onOpenChange(false)}
          isLoading={isLoading}
          error={error}
        />
      </DialogContent>
    </Dialog>
  )
}

interface EditContactModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  contact: Contact
  onSuccess: (contact: Contact) => void
}

export function EditContactModal({
  open,
  onOpenChange,
  contact,
  onSuccess,
}: EditContactModalProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(data: ContactFormData) {
    setIsLoading(true)
    setError(null)
    const tagsArray = data.tags ? data.tags.split(",").map((t) => t.trim()).filter(Boolean) : []
    try {
      const res = await fetch(`/api/contacts/${contact.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name,
          email: data.email,
          company: data.company || null,
          phone: data.phone || null,
          tags: tagsArray,
          notes: data.notes || null,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? "Failed to update contact")
        return
      }
      onSuccess(json as Contact)
      onOpenChange(false)
    } catch {
      setError("Something went wrong. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Contact</DialogTitle>
          <DialogDescription>
            Update the details for {contact.name}.
          </DialogDescription>
        </DialogHeader>
        <ContactForm
          defaultValues={{
            name: contact.name,
            email: contact.email,
            company: contact.company ?? "",
            phone: contact.phone ?? "",
            tags: contact.tags ? contact.tags.join(", ") : "",
            notes: contact.notes ?? "",
          }}
          onSubmit={handleSubmit}
          submitLabel="Save Changes"
          onCancel={() => onOpenChange(false)}
          isLoading={isLoading}
          error={error}
        />
      </DialogContent>
    </Dialog>
  )
}
