import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { updatePublicFormStatus } from "@/lib/services/public-forms";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const form = await updatePublicFormStatus(session.user.id, id, "ARCHIVED");
    return NextResponse.json({ form });
  } catch (error: unknown) {
    console.error("[POST /api/public-forms/[id]/archive]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to archive public form" },
      { status: 400 }
    );
  }
}
