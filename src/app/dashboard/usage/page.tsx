import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import UsageClient from "./usage-client";

export const metadata = {
  title: "Usage | ESign",
  description: "Track your ESign usage",
};

export default async function UsagePage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  return <UsageClient />;
}

