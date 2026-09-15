import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { FormSubmissionsClient } from "@/components/public-forms/form-submissions-client";

export default async function PublicFormSubmissionsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const { id } = await params;
  return <FormSubmissionsClient formId={id} />;
}
