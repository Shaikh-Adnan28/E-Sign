import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { EmptyState } from "@/components/shared/empty-state"
import { Users } from "lucide-react"

export default async function ContactsPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")
  return (
    <EmptyState
      icon={Users}
      heading="Contacts coming soon"
      description="Manage your signers and contacts in one place."
    />
  )
}
