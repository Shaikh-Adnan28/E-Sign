import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { UploadForm } from "./UploadForm"

export default async function SendPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  return <UploadForm />
}
