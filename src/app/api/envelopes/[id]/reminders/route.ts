import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { sendManualReminder } from "@/lib/services/reminders";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const result = await sendManualReminder(id, session.user.id);

    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to send reminder";
    console.error("[POST /api/envelopes/[id]/reminders]", msg);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
