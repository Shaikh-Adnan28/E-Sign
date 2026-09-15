import { NextResponse } from "next/server";
import { processExpiredEnvelopes, processExpirationWarnings } from "@/lib/services/expirations";

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    const secret = process.env.INTERNAL_JOB_SECRET;

    if (secret && authHeader !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const expirationResult = await processExpiredEnvelopes();
    const warningResult = await processExpirationWarnings();

    return NextResponse.json({
      success: true,
      expirations: expirationResult,
      warnings: warningResult,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to process expirations";
    console.error("[POST /api/internal/process-expirations]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
