import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { EmptyState } from "@/components/shared/empty-state"
import { Send } from "lucide-react"

export default async function SendPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")
  return (
    <EmptyState
      icon={Send}
      heading="Send document"
      description="Upload a PDF and send it out for signature."
    />
  )
}
