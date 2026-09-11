import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { EmptyState } from "@/components/shared/empty-state"
import { Settings } from "lucide-react"

export default async function SettingsPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")
  return (
    <EmptyState
      icon={Settings}
      heading="Settings coming soon"
      description="Configure your workspace, notifications, and preferences."
    />
  )
}
