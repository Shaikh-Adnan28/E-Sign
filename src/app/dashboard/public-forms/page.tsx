import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { PublicFormsClient } from "@/components/public-forms/public-forms-client";

export default async function PublicFormsPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  return <PublicFormsClient />;
}
