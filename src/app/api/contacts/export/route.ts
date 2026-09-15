import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { exportContactsCsv } from "@/lib/services/contacts";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const csvData = await exportContactsCsv(session.user.id);
    const dateStr = new Date().toISOString().split("T")[0];

    return new Response(csvData, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="esign-contacts-${dateStr}.csv"`,
        "Cache-Control": "no-cache",
      },
    });
  } catch (err) {
    console.error("[GET /api/contacts/export]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
