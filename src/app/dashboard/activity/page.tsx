import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { EmptyState } from "@/components/shared/empty-state"
import { Activity } from "lucide-react"

export default async function ActivityPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")
  return (
    <EmptyState
      icon={Activity}
      heading="Activity log"
      description="All actions on your documents will appear here."
    />
  )
}
