import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { TemplatesClient } from "@/components/templates/TemplatesClient"

export default async function TemplatesPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  return <TemplatesClient />
}
