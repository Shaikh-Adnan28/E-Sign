import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { EmptyState } from "@/components/shared/empty-state"
import { Copy } from "lucide-react"

export default async function TemplatesPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")
  return (
    <EmptyState
      icon={Copy}
      heading="Templates coming soon"
      description="Create reusable document templates to speed up your workflow."
    />
  )
}
