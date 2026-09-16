import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { HtmlBuilder } from "@/components/templates/html-builder";

export default async function HtmlTemplateNewPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }
  
  const resolvedParams = await searchParams;

  const name = typeof resolvedParams.name === "string" ? resolvedParams.name : "Untitled Template";
  const description = typeof resolvedParams.description === "string" ? resolvedParams.description : "";
  let roles = ["Signer 1"];
  
  if (typeof resolvedParams.roles === "string") {
    try {
      roles = JSON.parse(resolvedParams.roles);
    } catch {
      // fallback
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] w-full overflow-hidden">
      <div className="border-b px-6 py-4 flex items-center justify-between bg-white shrink-0">
        <div>
          <h1 className="text-xl font-bold text-slate-900">{name}</h1>
          <p className="text-sm text-slate-500">HTML Builder</p>
        </div>
      </div>
      <div className="flex-1 overflow-hidden relative">
        <HtmlBuilder name={name} description={description} roles={roles} />
      </div>
    </div>
  );
}
