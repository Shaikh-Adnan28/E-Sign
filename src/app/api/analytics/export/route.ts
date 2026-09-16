import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { exportAnalyticsReportCSV, DateRangePreset } from "@/lib/services/analytics";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const preset = (searchParams.get("preset") || searchParams.get("range") || "30d") as DateRangePreset;
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const section = searchParams.get("section") || "summary";

    const csvContent = await exportAnalyticsReportCSV(session.user.id, section, {
      preset,
      startDate,
      endDate,
    });

    const filename = `esign-analytics-${section}-${new Date().toISOString().slice(0, 10)}.csv`;

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error: unknown) {
    console.error("[GET /api/analytics/export]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to export report" },
      { status: 500 }
    );
  }
}
