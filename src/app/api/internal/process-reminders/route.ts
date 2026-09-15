import { NextResponse } from "next/server";
import { processDueReminders } from "@/lib/services/reminders";

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    const secret = process.env.INTERNAL_JOB_SECRET;

    if (secret && authHeader !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const result = await processDueReminders();
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to process reminders";
    console.error("[POST /api/internal/process-reminders]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
