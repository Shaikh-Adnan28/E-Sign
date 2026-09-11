import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { ContactsClient } from "@/components/contacts/contacts-client"

export const metadata = {
  title: "Contacts | ESign",
  description: "Manage your contacts and signers",
}

export default async function ContactsPage() {
  const session = await auth()
  if (!session?.user) redirect("/login")

  return <ContactsClient />
}
