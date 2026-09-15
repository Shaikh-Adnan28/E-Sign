import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { recordContactUsage } from "@/lib/services/contacts";

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
    await recordContactUsage(id, session.user.id);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[POST /api/contacts/[id]/used]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
