import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { DocumentsClient } from "@/components/documents/documents-client"

export default async function DocumentsPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")
  return <DocumentsClient />
}
